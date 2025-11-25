import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { getState } from "../_shared/wa-webhook-shared/state/store.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: "wa-webhook-profile",
      requestId,
      correlationId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      // Probe a guaranteed table to avoid false negatives during schema rollout
      const { error } = await supabase.from("profiles").select("user_id").limit(1);
      return respond({
        status: error ? "unhealthy" : "healthy",
        service: "wa-webhook-profile",
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected", table: "profiles" },
        version: "2.0.0",
      }, { status: error ? 503 : 200 });
    } catch (err) {
      return respond({
        status: "unhealthy",
        service: "wa-webhook-profile",
        error: err instanceof Error ? err.message : String(err),
      }, { status: 503 });
    }
  }

  // Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { 
        status: 200,
        headers: { "X-Request-ID": requestId, "X-Correlation-ID": correlationId },
      });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Only POST is allowed for webhook messages
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  // Main webhook handler
  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify WhatsApp signature (Security requirement per docs/GROUND_RULES.md)
    const signatureHeader = req.headers.has("x-hub-signature-256")
      ? "x-hub-signature-256"
      : req.headers.has("x-hub-signature")
      ? "x-hub-signature"
      : null;
    const signature = signatureHeader ? req.headers.get(signatureHeader) : null;
    const signatureMeta = (() => {
      if (!signature) {
        return {
          provided: false,
          header: signatureHeader,
          method: null as string | null,
          sample: null as string | null,
        };
      }
      const [method, hash] = signature.split("=", 2);
      return {
        provided: true,
        header: signatureHeader,
        method: method?.toLowerCase() ?? null,
        sample: hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : null,
      };
    })();
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("WA_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    const internalForward = req.headers.get("x-wa-internal-forward") === "true";

    if (!appSecret) {
      logEvent("PROFILE_AUTH_CONFIG_ERROR", { error: "WHATSAPP_APP_SECRET not configured" }, "error");
      return respond({ error: "server_misconfigured" }, { status: 500 });
    }

    let isValidSignature = false;
    if (signature) {
      try {
        isValidSignature = await verifyWebhookSignature(rawBody, signature, appSecret);
        if (isValidSignature) {
          logEvent("PROFILE_SIGNATURE_VALID", {
            signatureHeader,
            signatureMethod: signatureMeta.method,
          });
        }
      } catch (err) {
        logEvent("PROFILE_SIGNATURE_ERROR", {
          error: err instanceof Error ? err.message : String(err),
        }, "error");
      }
    }

    if (!isValidSignature) {
      if (allowUnsigned || internalForward) {
        logEvent("PROFILE_AUTH_BYPASS", {
          reason: internalForward ? "internal_forward" : signature ? "signature_mismatch" : "no_signature",
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        }, "warn");
      } else {
        logEvent("PROFILE_AUTH_FAILED", {
          signatureProvided: signatureMeta.provided,
          signatureHeader,
          signatureMethod: signatureMeta.method,
          signatureSample: signatureMeta.sample,
          userAgent: req.headers.get("user-agent"),
        }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    }

    // Parse payload after verification
    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return respond({ success: true, ignored: "no_message" });
    }

    const from = message.from;
    if (!from) {
      return respond({ success: true, ignored: "no_sender" });
    }

    // Build Context - Auto-create profile if needed
    const { ensureProfile } = await import("../_shared/wa-webhook-shared/utils/profile.ts");
    const profile = await ensureProfile(supabase, from);

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en",
    };

    logEvent("PROFILE_MESSAGE_PROCESSING", { from, type: message.type, hasProfile: !!profile });

    // Get State
    const state = ctx.profileId ? await getState(supabase, ctx.profileId) : null;
    logEvent("PROFILE_STATE", { key: state?.key });

    let handled = false;

    // Handle Interactive Messages (Buttons/Lists)
    if (message.type === "interactive") {
      const interactive = message.interactive as any;
      const buttonId = interactive?.button_reply?.id;
      const listId = interactive?.list_reply?.id;
      const id = buttonId || listId;

      if (id) {
        logEvent("PROFILE_INTERACTION", { id });

        // Profile Home
        if (id === "profile") {
          const { startProfile } = await import("./profile/home.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Wallet Home
        else if (id === IDS.WALLET_HOME || id === "wallet") {
          const { startWallet } = await import("./wallet/home.ts");
          handled = await startWallet(ctx, state ?? { key: "home" });
        }
        
        // My Businesses
        else if (id === IDS.MY_BUSINESSES || id === "my_business") {
          const { listMyBusinesses } = await import("./business/list.ts");
          handled = await listMyBusinesses(ctx);
        }
        else if (id === IDS.CREATE_BUSINESS) {
          const { startCreateBusiness } = await import("./business/list.ts");
          handled = await startCreateBusiness(ctx);
        }
        else if (id.startsWith("BIZ::")) {
          const businessId = id.replace("BIZ::", "");
          const { handleBusinessSelection } = await import("./business/list.ts");
          handled = await handleBusinessSelection(ctx, businessId);
        }
        
        // My Jobs
        else if (id === IDS.MY_JOBS || id === "my_jobs") {
          const { listMyJobs } = await import("./jobs/list.ts");
          handled = await listMyJobs(ctx);
        }
        else if (id.startsWith("JOB::")) {
          const jobId = id.replace("JOB::", "");
          const { handleJobSelection } = await import("./jobs/list.ts");
          handled = await handleJobSelection(ctx, jobId);
        }
        
        // My Properties
        else if (id === IDS.MY_PROPERTIES || id === "my_properties") {
          const { listMyProperties } = await import("./properties/list.ts");
          handled = await listMyProperties(ctx);
        }
        else if (id.startsWith("PROP::")) {
          const propertyId = id.replace("PROP::", "");
          const { handlePropertySelection } = await import("./properties/list.ts");
          handled = await handlePropertySelection(ctx, propertyId);
        }
        
        // Saved Locations
        else if (id === IDS.SAVED_LOCATIONS || id === "saved_locations") {
          const { listSavedLocations } = await import("./profile/locations.ts");
          handled = await listSavedLocations(ctx);
        }
        else if (id.startsWith("LOC::")) {
          const locationId = id.replace("LOC::", "");
          const { handleLocationSelection } = await import("./profile/locations.ts");
          handled = await handleLocationSelection(ctx, locationId);
        }
        
        // Back to Profile
        else if (id === IDS.BACK_PROFILE) {
          const { startProfile } = await import("./profile/home.ts");
          handled = await startProfile(ctx, state ?? { key: "home" });
        }
        
        // Wallet Earn
        else if (id === IDS.WALLET_EARN) {
          const { handleWalletEarn } = await import("./wallet/earn.ts");
          handled = await handleWalletEarn(ctx);
        }
        
        // Wallet Transfer
        else if (id === IDS.WALLET_TRANSFER) {
          const { handleWalletTransfer } = await import("./wallet/transfer.ts");
          handled = await handleWalletTransfer(ctx, state as any);
        }
        
        // Wallet Redeem
        else if (id === IDS.WALLET_REDEEM) {
          const { handleWalletRedeem } = await import("./wallet/redeem.ts");
          handled = await handleWalletRedeem(ctx);
        }
        
        // Wallet Top (Leaderboard)
        else if (id === IDS.WALLET_TOP) {
          const { handleWalletTop } = await import("./wallet/top.ts");
          handled = await handleWalletTop(ctx);
        }
        
        // Wallet Transactions
        else if (id === IDS.WALLET_TRANSACTIONS) {
          const { handleWalletTransactions } = await import("./wallet/transactions.ts");
          handled = await handleWalletTransactions(ctx);
        }
        
        // Wallet Referral
        else if (id === IDS.WALLET_REFERRAL || id === IDS.WALLET_SHARE) {
          const { handleWalletReferral } = await import("./wallet/referral.ts");
          handled = await handleWalletReferral(ctx);
        }
        
        // Reward selection
        else if (id.startsWith("REWARD::") && state?.key === "wallet_redeem") {
          const { handleRewardSelection } = await import("./wallet/redeem.ts");
          handled = await handleRewardSelection(ctx, state.data as any, id);
        }
        
        // Transfer partner selection
        else if (id.startsWith("PARTNER::") && state?.key === "wallet_transfer_partner") {
          const { handlePartnerSelection } = await import("./wallet/transfer.ts");
          handled = await handlePartnerSelection(ctx, state.data as any, id);
        }
      }
    }

    // Handle Text Messages
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      
      // Check for menu selection key first
      if (text === "profile") {
        const { startProfile } = await import("./profile/home.ts");
        handled = await startProfile(ctx, state ?? { key: "home" });
      }
      // Wallet keywords
      else if (text.includes("wallet") || text.includes("balance")) {
        const { startWallet } = await import("./wallet/home.ts");
        handled = await startWallet(ctx, state ?? { key: "home" });
      } else if (text.includes("transfer") || text.includes("send")) {
        const { handleWalletTransfer } = await import("./wallet/transfer.ts");
        handled = await handleWalletTransfer(ctx, state as any);
      } else if (text.includes("redeem") || text.includes("reward")) {
        const { handleWalletRedeem } = await import("./wallet/redeem.ts");
        handled = await handleWalletRedeem(ctx);
      } else if (text.includes("earn") || text.includes("get token")) {
        const { handleWalletEarn } = await import("./wallet/earn.ts");
        handled = await handleWalletEarn(ctx);
      } else if (text.includes("share") || text.includes("referral")) {
        const { handleWalletReferral } = await import("./wallet/referral.ts");
        handled = await handleWalletReferral(ctx);
      } else if (text.includes("transaction") || text.includes("history")) {
        const { handleWalletTransactions } = await import("./wallet/transactions.ts");
        handled = await handleWalletTransactions(ctx);
      }
      
      // MOMO QR Text
      else if (text.includes("momo") || text.includes("qr") || state?.key?.startsWith("momo_qr")) {
        const { handleMomoText, startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        if (state?.key?.startsWith("momo_qr")) {
            handled = await handleMomoText(ctx, (message.text as any)?.body ?? "", state);
        } else {
            handled = await startMomoQr(ctx, state ?? { key: "home" });
        }
      }

      // Handle transfer amount input
      else if (state?.key === "wallet_transfer_amount") {
        const { handleTransferAmount } = await import("./wallet/transfer.ts");
        handled = await handleTransferAmount(ctx, state.data as any, text);
      }
      
      // Handle transfer phone input
      else if (state?.key === "wallet_transfer_phone") {
        const { handleTransferPhone } = await import("./wallet/transfer.ts");
        handled = await handleTransferPhone(ctx, state.data as any, text);
      }
    }

    if (!handled) {
      logEvent("PROFILE_UNHANDLED_MESSAGE", { from, type: message.type });
    }

    return respond({ success: true, handled });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent("PROFILE_WEBHOOK_ERROR", { error: message }, "error");
    console.error("profile.webhook_error", message);

    return respond({
      error: "internal_error",
      service: "wa-webhook-profile",
      requestId,
    }, {
      status: 500,
    });
  }
});

console.log("✅ wa-webhook-profile service started (v2.0.0)");
