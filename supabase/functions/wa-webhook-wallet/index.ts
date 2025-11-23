import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getState } from "../wa-webhook/state/store.ts";
import { handleWalletHome } from "../wa-webhook/domains/wallet/home.ts";
import { handleWalletTransfer } from "../wa-webhook/domains/wallet/transfer.ts";
import { handleWalletRedeem } from "../wa-webhook/domains/wallet/redeem.ts";
import { handleWalletEarn } from "../wa-webhook/domains/wallet/earn.ts";
import { handleWalletTop } from "../wa-webhook/domains/wallet/top.ts";
import { handleWalletTransactions } from "../wa-webhook/domains/wallet/transactions.ts";
import { handleWalletReferral } from "../wa-webhook/domains/wallet/referral.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "../wa-webhook/types.ts";
import { IDS } from "../wa-webhook/wa/ids.ts";

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
      service: "wa-webhook-wallet",
      requestId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("wallet_transactions").select("id").limit(1);
      return respond({
        status: error ? "unhealthy" : "healthy",
        service: "wa-webhook-wallet",
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected" },
        version: "2.0.0",
      }, { status: error ? 503 : 200 });
    } catch (err) {
      return respond({
        status: "unhealthy",
        service: "wa-webhook-wallet",
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
    const payload: WhatsAppWebhookPayload = await req.json();
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

    // Build Context
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, language")
      .or(`phone_number.eq.${from},wa_id.eq.${from}`)
      .maybeSingle();

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en",
    };

    logEvent("WALLET_MESSAGE_PROCESSING", { from, type: message.type });

    // Get State
    const state = ctx.profileId ? await getState(supabase, ctx.profileId) : null;
    logEvent("WALLET_STATE", { key: state?.key });

    let handled = false;

    // Handle Interactive Messages (Buttons/Lists)
    if (message.type === "interactive") {
      const interactive = message.interactive as any;
      const buttonId = interactive?.button_reply?.id;
      const listId = interactive?.list_reply?.id;
      const id = buttonId || listId;

      if (id) {
        logEvent("WALLET_INTERACTION", { id });

        // Wallet Home
        if (id === IDS.WALLET_HOME) {
          handled = await handleWalletHome(ctx);
        }
        
        // Wallet Earn
        else if (id === IDS.WALLET_EARN) {
          handled = await handleWalletEarn(ctx);
        }
        
        // Wallet Transfer
        else if (id === IDS.WALLET_TRANSFER) {
          handled = await handleWalletTransfer(ctx, state as any);
        }
        
        // Wallet Redeem
        else if (id === IDS.WALLET_REDEEM) {
          handled = await handleWalletRedeem(ctx);
        }
        
        // Wallet Top (Leaderboard)
        else if (id === IDS.WALLET_TOP) {
          handled = await handleWalletTop(ctx);
        }
        
        // Wallet Transactions
        else if (id === IDS.WALLET_TRANSACTIONS) {
          handled = await handleWalletTransactions(ctx);
        }
        
        // Wallet Referral
        else if (id === IDS.WALLET_REFERRAL || id === IDS.WALLET_SHARE) {
          handled = await handleWalletReferral(ctx);
        }
        
        // Reward selection
        else if (id.startsWith("REWARD::") && state?.key === "wallet_redeem") {
          const { handleRewardSelection } = await import("../wa-webhook/domains/wallet/redeem.ts");
          handled = await handleRewardSelection(ctx, state.data as any, id);
        }
        
        // Transfer partner selection
        else if (id.startsWith("PARTNER::") && state?.key === "wallet_transfer_partner") {
          const { handlePartnerSelection } = await import("../wa-webhook/domains/wallet/transfer.ts");
          handled = await handlePartnerSelection(ctx, state.data as any, id);
        }
      }
    }

    // Handle Text Messages
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      
      // Wallet keywords
      if (text.includes("wallet") || text.includes("balance")) {
        handled = await handleWalletHome(ctx);
      } else if (text.includes("transfer") || text.includes("send")) {
        handled = await handleWalletTransfer(ctx, state as any);
      } else if (text.includes("redeem") || text.includes("reward")) {
        handled = await handleWalletRedeem(ctx);
      } else if (text.includes("earn") || text.includes("get token")) {
        handled = await handleWalletEarn(ctx);
      } else if (text.includes("share") || text.includes("referral")) {
        handled = await handleWalletReferral(ctx);
      } else if (text.includes("transaction") || text.includes("history")) {
        handled = await handleWalletTransactions(ctx);
      }
      
      // Handle transfer amount input
      else if (state?.key === "wallet_transfer_amount") {
        const { handleTransferAmount } = await import("../wa-webhook/domains/wallet/transfer.ts");
        handled = await handleTransferAmount(ctx, state.data as any, text);
      }
      
      // Handle transfer phone input
      else if (state?.key === "wallet_transfer_phone") {
        const { handleTransferPhone } = await import("../wa-webhook/domains/wallet/transfer.ts");
        handled = await handleTransferPhone(ctx, state.data as any, text);
      }
    }

    if (!handled) {
      logEvent("WALLET_UNHANDLED_MESSAGE", { from, type: message.type });
    }

    return respond({ success: true, handled });

  } catch (err) {
    logEvent("WALLET_WEBHOOK_ERROR", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");

    return respond({
      error: "internal_error",
      service: "wa-webhook-wallet",
      requestId,
    }, {
      status: 500,
    });
  }
});

console.log("✅ wa-webhook-wallet service started (v2.0.0)");
