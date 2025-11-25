import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
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

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
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
      return new Response(challenge ?? "", { status: 200 });
    }
    return respond({ error: "forbidden" }, { status: 403 });
  }

  // Main webhook handler
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";

    if (signatureHeader && appSecret) {
      const { verifyWebhookSignature } = await import("../_shared/webhook-utils.ts");
      const isValid = await verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid && !allowUnsigned) {
        logEvent("PROFILE_AUTH_FAILED", { signatureHeader }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    } else if (!allowUnsigned) {
      logEvent("PROFILE_AUTH_MISSING_SIGNATURE", {}, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

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
        
        // Profile Edit
        else if (id === "EDIT_PROFILE" || id === "edit_profile") {
          const { startEditProfile } = await import("./profile/edit.ts");
          handled = await startEditProfile(ctx);
        }
        else if (id === "EDIT_PROFILE_NAME") {
          const { promptEditName } = await import("./profile/edit.ts");
          handled = await promptEditName(ctx);
        }
        else if (id === "EDIT_PROFILE_LANGUAGE") {
          const { promptEditLanguage } = await import("./profile/edit.ts");
          handled = await promptEditLanguage(ctx);
        }
        else if (id.startsWith("LANG::")) {
          const languageCode = id.replace("LANG::", "");
          const { handleEditLanguage } = await import("./profile/edit.ts");
          handled = await handleEditLanguage(ctx, languageCode);
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
        else if (id.startsWith("EDIT_BIZ::")) {
          const businessId = id.replace("EDIT_BIZ::", "");
          const { startEditBusiness } = await import("./business/update.ts");
          handled = await startEditBusiness(ctx, businessId);
        }
        else if (id.startsWith("DELETE_BIZ::")) {
          const businessId = id.replace("DELETE_BIZ::", "");
          const { confirmDeleteBusiness } = await import("./business/delete.ts");
          handled = await confirmDeleteBusiness(ctx, businessId);
        }
        else if (id.startsWith("CONFIRM_DELETE_BIZ::")) {
          const businessId = id.replace("CONFIRM_DELETE_BIZ::", "");
          const { handleDeleteBusiness } = await import("./business/delete.ts");
          handled = await handleDeleteBusiness(ctx, businessId);
        }
        else if (id.startsWith("EDIT_BIZ_NAME::")) {
          const businessId = id.replace("EDIT_BIZ_NAME::", "");
          const { promptEditField } = await import("./business/update.ts");
          handled = await promptEditField(ctx, businessId, "name");
        }
        else if (id.startsWith("EDIT_BIZ_DESC::")) {
          const businessId = id.replace("EDIT_BIZ_DESC::", "");
          const { promptEditField } = await import("./business/update.ts");
          handled = await promptEditField(ctx, businessId, "description");
        }
        else if (id.startsWith("BACK_BIZ::")) {
          const businessId = id.replace("BACK_BIZ::", "");
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
        else if (id === IDS.CREATE_JOB) {
          const { startCreateJob } = await import("./jobs/create.ts");
          handled = await startCreateJob(ctx);
        }
        else if (id.startsWith("EDIT_JOB::")) {
          const jobId = id.replace("EDIT_JOB::", "");
          const { startEditJob } = await import("./jobs/update.ts");
          handled = await startEditJob(ctx, jobId);
        }
        else if (id.startsWith("DELETE_JOB::")) {
          const jobId = id.replace("DELETE_JOB::", "");
          const { confirmDeleteJob } = await import("./jobs/delete.ts");
          handled = await confirmDeleteJob(ctx, jobId);
        }
        else if (id.startsWith("CONFIRM_DELETE_JOB::")) {
          const jobId = id.replace("CONFIRM_DELETE_JOB::", "");
          const { handleDeleteJob } = await import("./jobs/delete.ts");
          handled = await handleDeleteJob(ctx, jobId);
        }
        else if (id.startsWith("EDIT_JOB_TITLE::")) {
          const jobId = id.replace("EDIT_JOB_TITLE::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "title");
        }
        else if (id.startsWith("EDIT_JOB_DESC::")) {
          const jobId = id.replace("EDIT_JOB_DESC::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "description");
        }
        else if (id.startsWith("EDIT_JOB_LOC::")) {
          const jobId = id.replace("EDIT_JOB_LOC::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "location");
        }
        else if (id.startsWith("EDIT_JOB_REQ::")) {
          const jobId = id.replace("EDIT_JOB_REQ::", "");
          const { promptEditJobField } = await import("./jobs/update.ts");
          handled = await promptEditJobField(ctx, jobId, "requirements");
        }
        else if (id.startsWith("BACK_JOB::")) {
          const jobId = id.replace("BACK_JOB::", "");
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
        else if (id === IDS.CREATE_PROPERTY) {
          const { startCreateProperty } = await import("./properties/create.ts");
          handled = await startCreateProperty(ctx);
        }
        else if (id.startsWith("EDIT_PROP::")) {
          const propertyId = id.replace("EDIT_PROP::", "");
          const { startEditProperty } = await import("./properties/update.ts");
          handled = await startEditProperty(ctx, propertyId);
        }
        else if (id.startsWith("DELETE_PROP::")) {
          const propertyId = id.replace("DELETE_PROP::", "");
          const { confirmDeleteProperty } = await import("./properties/delete.ts");
          handled = await confirmDeleteProperty(ctx, propertyId);
        }
        else if (id.startsWith("CONFIRM_DELETE_PROP::")) {
          const propertyId = id.replace("CONFIRM_DELETE_PROP::", "");
          const { handleDeleteProperty } = await import("./properties/delete.ts");
          handled = await handleDeleteProperty(ctx, propertyId);
        }
        else if (id.startsWith("EDIT_PROP_TITLE::")) {
          const propertyId = id.replace("EDIT_PROP_TITLE::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "title");
        }
        else if (id.startsWith("EDIT_PROP_DESC::")) {
          const propertyId = id.replace("EDIT_PROP_DESC::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "description");
        }
        else if (id.startsWith("EDIT_PROP_LOC::")) {
          const propertyId = id.replace("EDIT_PROP_LOC::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "location");
        }
        else if (id.startsWith("EDIT_PROP_PRICE::")) {
          const propertyId = id.replace("EDIT_PROP_PRICE::", "");
          const { promptEditPropertyField } = await import("./properties/update.ts");
          handled = await promptEditPropertyField(ctx, propertyId, "price");
        }
        else if (id.startsWith("BACK_PROP::")) {
          const propertyId = id.replace("BACK_PROP::", "");
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
          const { showWalletEarn } = await import("./wallet/earn.ts");
          handled = await showWalletEarn(ctx);
        }
        
        // Wallet Share - WhatsApp
        else if (id === IDS.WALLET_SHARE_WHATSAPP || id === IDS.WALLET_SHARE_QR || id === IDS.WALLET_SHARE_DONE) {
          const { handleWalletEarnSelection, handleWalletShareDone } = await import("./wallet/earn.ts");
          if (id === IDS.WALLET_SHARE_DONE) {
            handled = await handleWalletShareDone(ctx);
          } else {
            handled = await handleWalletEarnSelection(ctx, state as any, id);
          }
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
        
        // Token Purchase
        else if (id === "WALLET_PURCHASE" || id === "buy_tokens") {
          const { handleWalletPurchase } = await import("./wallet/purchase.ts");
          handled = await handleWalletPurchase(ctx);
        }
        else if (id.startsWith("purchase_")) {
          const { handlePurchasePackage } = await import("./wallet/purchase.ts");
          handled = await handlePurchasePackage(ctx, id);
        }
        
        // Cash Out
        else if (id === "WALLET_CASHOUT" || id === "cash_out") {
          const { handleCashOut } = await import("./wallet/cashout.ts");
          handled = await handleCashOut(ctx);
        }
        else if (id === "cashout_confirm_yes") {
          const { handleCashOutConfirm } = await import("./wallet/cashout.ts");
          handled = await handleCashOutConfirm(ctx);
        }
        else if (id === "cashout_confirm_no") {
          const { handleCashOutCancel } = await import("./wallet/cashout.ts");
          handled = await handleCashOutCancel(ctx);
        }
        
        // MoMo QR
        else if (id === IDS.MOMO_QR || id.startsWith("momoqr_")) {
          const { handleMomoButton, startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          const momoState = state ?? { key: "momo_qr_menu", data: {} };
          if (id === IDS.MOMO_QR) {
            handled = await startMomoQr(ctx, momoState);
          } else {
            handled = await handleMomoButton(ctx, id, momoState);
          }
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
      
      // Purchase keywords
      else if (["buy", "buy tokens", "purchase", "purchase tokens"].includes(text)) {
        const { handleWalletPurchase } = await import("./wallet/purchase.ts");
        handled = await handleWalletPurchase(ctx);
      }
      
      // Cash-out keywords
      else if (["cash out", "cashout", "withdraw", "withdrawal"].includes(text)) {
        const { handleCashOut } = await import("./wallet/cashout.ts");
        handled = await handleCashOut(ctx);
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
      
      // Handle purchase amount input
      else if (state?.key === "wallet_purchase_amount") {
        const { handlePurchaseAmount } = await import("./wallet/purchase.ts");
        handled = await handlePurchaseAmount(ctx, text);
      }
      
      // Handle cash-out amount input
      else if (state?.key === "wallet_cashout_amount") {
        const { handleCashOutAmount } = await import("./wallet/cashout.ts");
        handled = await handleCashOutAmount(ctx, text);
      }
      
      // Handle cash-out phone input
      else if (state?.key === "wallet_cashout_phone") {
        const { handleCashOutPhone } = await import("./wallet/cashout.ts");
        handled = await handleCashOutPhone(ctx, text);
      }
      
      // Handle business creation name
      else if (state?.key === "business_create_name") {
        const { handleCreateBusinessName } = await import("./business/create.ts");
        handled = await handleCreateBusinessName(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle business edit fields
      else if (state?.key === "business_edit_name") {
        const { handleUpdateBusinessField } = await import("./business/update.ts");
        handled = await handleUpdateBusinessField(ctx, state.data.businessId, "name", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "business_edit_description") {
        const { handleUpdateBusinessField } = await import("./business/update.ts");
        handled = await handleUpdateBusinessField(ctx, state.data.businessId, "description", (message.text as any)?.body ?? "");
      }
      
      // Handle job creation title
      else if (state?.key === "job_create_title") {
        const { handleCreateJobTitle } = await import("./jobs/create.ts");
        handled = await handleCreateJobTitle(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle job edit fields
      else if (state?.key === "job_edit_title") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "title", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "job_edit_description") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "description", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "job_edit_location") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "location", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "job_edit_requirements") {
        const { handleUpdateJobField } = await import("./jobs/update.ts");
        handled = await handleUpdateJobField(ctx, state.data.jobId, "requirements", (message.text as any)?.body ?? "");
      }
      
      // Handle property creation title
      else if (state?.key === "property_create_title") {
        const { handleCreatePropertyTitle } = await import("./properties/create.ts");
        handled = await handleCreatePropertyTitle(ctx, (message.text as any)?.body ?? "");
      }
      
      // Handle property edit fields
      else if (state?.key === "property_edit_title") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "title", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "property_edit_description") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "description", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "property_edit_location") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "location", (message.text as any)?.body ?? "");
      }
      else if (state?.key === "property_edit_price") {
        const { handleUpdatePropertyField } = await import("./properties/update.ts");
        handled = await handleUpdatePropertyField(ctx, state.data.propertyId, "price", (message.text as any)?.body ?? "");
      }
      
      // Handle profile edit name
      else if (state?.key === "profile_edit_name") {
        const { handleEditName } = await import("./profile/edit.ts");
        handled = await handleEditName(ctx, (message.text as any)?.body ?? "");
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
