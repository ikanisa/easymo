/**
 * wa-webhook-wallet - Dedicated Wallet Microservice
 *
 * Handles all wallet-related operations:
 * - Wallet home/balance display
 * - Token transfers
 * - Earn tokens (referrals, sharing)
 * - Redeem rewards
 * - Transaction history
 * - Referral code management
 * - Token purchase
 * - Cash out
 * - MoMo QR generation
 * - Top promoters leaderboard
 *
 * Extracted from wa-webhook-profile to follow single-responsibility principle.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getState, setState, clearState } from "../_shared/wa-webhook-shared/state/store.ts";
import { sendButtonsMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "../_shared/wa-webhook-shared/types.ts";
import { IDS } from "../_shared/wa-webhook-shared/wa/ids.ts";
import { WEBHOOK_CONFIG } from "../_shared/config/webhooks.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";

const walletConfig = WEBHOOK_CONFIG.wallet;

const SERVICE_NAME = "wa-webhook-wallet";
const SERVICE_VERSION = "1.0.0";
const MAX_BODY_SIZE = walletConfig.maxBodySize;

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
    headers.set("X-Service", SERVICE_NAME);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  const logEvent = (
    event: string,
    details: Record<string, unknown> = {},
    level: "debug" | "info" | "warn" | "error" = "info",
  ) => {
    logStructuredEvent(event, {
      service: SERVICE_NAME,
      requestId,
      correlationId,
      path: url.pathname,
      ...details,
    }, level);
  };

  // Health check
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    try {
      const { error } = await supabase.from("wallet_accounts").select("id").limit(1);
      return respond({
        status: error ? "unhealthy" : "healthy",
        service: SERVICE_NAME,
        timestamp: new Date().toISOString(),
        checks: { database: error ? "disconnected" : "connected", table: "wallet_accounts" },
        version: SERVICE_VERSION,
      }, { status: error ? 503 : 200 });
    } catch (err) {
      return respond({
        status: "unhealthy",
        service: SERVICE_NAME,
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

    // Security: Body size validation
    if (rawBody.length > MAX_BODY_SIZE) {
      logEvent("WALLET_BODY_TOO_LARGE", { size: rawBody.length }, "warn");
      return respond({ error: "payload_too_large" }, { status: 413 });
    }

    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    const allowUnsigned = (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";

    if (signatureHeader && appSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid && !allowUnsigned) {
        logEvent("WALLET_AUTH_FAILED", { signatureHeader }, "warn");
        return respond({ error: "unauthorized" }, { status: 401 });
      }
    } else if (!allowUnsigned) {
      logEvent("WALLET_AUTH_MISSING_SIGNATURE", {}, "warn");
      return respond({ error: "unauthorized" }, { status: 401 });
    }

    // Parse payload
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      logEvent("WALLET_INVALID_JSON", {}, "warn");
      return respond({ error: "invalid_payload" }, { status: 400 });
    }

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

    // Idempotency check
    const messageId = (message as any).id;
    if (messageId) {
      const { data: processed } = await supabase
        .from("processed_webhooks")
        .select("id")
        .eq("message_id", messageId)
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .maybeSingle();

      if (processed) {
        logEvent("WALLET_DUPLICATE_MESSAGE", { messageId, from }, "debug");
        return respond({ success: true, ignored: "duplicate" });
      }

      supabase
        .from("processed_webhooks")
        .insert({
          message_id: messageId,
          phone_number: from,
          webhook_type: "wallet",
          created_at: new Date().toISOString(),
        })
        .then(() => {}, (err: Error) => {
          logEvent("WALLET_IDEMPOTENCY_INSERT_FAILED", { error: err.message }, "warn");
        });
    }

    // Build Context
    const profile = await ensureProfile(supabase, from);

    const ctx: RouterContext = {
      supabase,
      from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en",
    };

    logEvent("WALLET_MESSAGE_PROCESSING", { from, type: message.type, hasProfile: !!profile });

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
        if (id === IDS.WALLET_HOME || id === "WALLET_HOME" || id === IDS.WALLET || id === "wallet" || id === "wallet_tokens") {
          const { startWallet } = await import("../wa-webhook-profile/wallet/home.ts");
          handled = await startWallet(ctx, state ?? { key: "home" });
        }

        // Wallet Earn
        else if (id === IDS.WALLET_EARN) {
          const { showWalletEarn } = await import("../wa-webhook-profile/wallet/earn.ts");
          handled = await showWalletEarn(ctx);
        }
        else if (id === IDS.WALLET_VIEW_BALANCE) {
          const { showWalletBalance } = await import("../wa-webhook-profile/wallet/home.ts");
          handled = await showWalletBalance(ctx);
        }

        // Wallet Share - WhatsApp
        else if (id === IDS.WALLET_SHARE_WHATSAPP || id === IDS.WALLET_SHARE_QR || id === IDS.WALLET_SHARE_DONE) {
          const { handleWalletEarnSelection, handleWalletShareDone } = await import("../wa-webhook-profile/wallet/earn.ts");
          if (id === IDS.WALLET_SHARE_DONE) {
            handled = await handleWalletShareDone(ctx);
          } else {
            handled = await handleWalletEarnSelection(ctx, state as any, id);
          }
        }

        // Wallet Transfer
        else if (id === IDS.WALLET_TRANSFER) {
          const { startWalletTransfer } = await import("../wa-webhook-profile/wallet/transfer.ts");
          handled = await startWalletTransfer(ctx);
        }

        // Wallet Redeem
        else if (id === IDS.WALLET_REDEEM) {
          const { showWalletRedeem } = await import("../wa-webhook-profile/wallet/redeem.ts");
          handled = await showWalletRedeem(ctx);
        }

        // Wallet Top (Leaderboard)
        else if (id === IDS.WALLET_TOP) {
          const { showWalletTop } = await import("../wa-webhook-profile/wallet/top.ts");
          handled = await showWalletTop(ctx);
        }

        // Wallet Transactions
        else if (id === IDS.WALLET_TRANSACTIONS) {
          const { showWalletTransactions } = await import("../wa-webhook-profile/wallet/transactions.ts");
          handled = await showWalletTransactions(ctx);
        }

        // Wallet Referral
        else if (id === IDS.WALLET_REFERRAL || id === IDS.WALLET_SHARE) {
          const { handleWalletReferral } = await import("../wa-webhook-profile/wallet/referral.ts");
          handled = await handleWalletReferral(ctx);
        }
        else if (id.startsWith("partner::") || id === "manual_recipient") {
          const { handleWalletTransferSelection } = await import("../wa-webhook-profile/wallet/transfer.ts");
          handled = await handleWalletTransferSelection(ctx, state as any, id);
        }
        else if (id.startsWith("wallet_tx::")) {
          const { showWalletTransactions } = await import("../wa-webhook-profile/wallet/transactions.ts");
          handled = await showWalletTransactions(ctx);
        }
        else if (id.startsWith("wallet_top::")) {
          const { showWalletTop } = await import("../wa-webhook-profile/wallet/top.ts");
          handled = await showWalletTop(ctx);
        }

        // Share EasyMO
        else if (id === IDS.SHARE_EASYMO) {
          if (ctx.profileId) {
            const { ensureReferralLink } = await import("../_shared/wa-webhook-shared/utils/share.ts");
            const { t } = await import("../_shared/wa-webhook-shared/i18n/translator.ts");
            try {
              const link = await ensureReferralLink(ctx.supabase, ctx.profileId);
              const shareText = [
                t(ctx.locale, "wallet.earn.forward.instructions"),
                t(ctx.locale, "wallet.earn.share_text_intro"),
                link.waLink,
                t(ctx.locale, "wallet.earn.copy.code", { code: link.code }),
                t(ctx.locale, "wallet.earn.note.keep_code"),
              ].join("\n\n");

              await sendButtonsMessage(
                ctx,
                shareText,
                [
                  { id: IDS.WALLET_EARN, title: t(ctx.locale, "wallet.earn.button") },
                  { id: IDS.BACK_MENU, title: "← Back" },
                ],
              );
              handled = true;
            } catch (e) {
              await sendButtonsMessage(
                ctx,
                t(ctx.locale, "wallet.earn.error"),
                [{ id: IDS.BACK_MENU, title: "← Back" }],
              );
              handled = true;
            }
          }
        }

        // Token Purchase
        else if (id === "WALLET_PURCHASE" || id === "buy_tokens") {
          const { handleWalletPurchase } = await import("../wa-webhook-profile/wallet/purchase.ts");
          handled = await handleWalletPurchase(ctx);
        }
        else if (id.startsWith("purchase_")) {
          const { handlePurchasePackage } = await import("../wa-webhook-profile/wallet/purchase.ts");
          handled = await handlePurchasePackage(ctx, id);
        }

        // Cash Out
        else if (id === "WALLET_CASHOUT" || id === "cash_out") {
          const { handleCashOut } = await import("../wa-webhook-profile/wallet/cashout.ts");
          handled = await handleCashOut(ctx);
        }
        else if (id === "cashout_confirm_yes") {
          const { handleCashOutConfirm } = await import("../wa-webhook-profile/wallet/cashout.ts");
          handled = await handleCashOutConfirm(ctx);
        }
        else if (id === "cashout_confirm_no") {
          const { handleCashOutCancel } = await import("../wa-webhook-profile/wallet/cashout.ts");
          handled = await handleCashOutCancel(ctx);
        }

        // MoMo QR
        else if (id === IDS.MOMO_QR || id === "momo_qr") {
          const { startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          handled = await startMomoQr(ctx, state ?? { key: "home" });
        }
        else if (id === IDS.MOMO_QR_MY || id === IDS.MOMO_QR_NUMBER || id === IDS.MOMO_QR_CODE) {
          const { handleMomoButton } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          handled = await handleMomoButton(ctx, id, state ?? { key: "home", data: {} });
        }
        else if (id.startsWith("momoqr_")) {
          const { handleMomoButton, startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
          const momoState = state ?? { key: "momo_qr_menu", data: {} };
          if (id === IDS.MOMO_QR) {
            handled = await startMomoQr(ctx, momoState);
          } else {
            handled = await handleMomoButton(ctx, id, momoState);
          }
        }

        // Back to Menu
        else if (id === IDS.BACK_MENU || id === "back_menu") {
          const { startWallet } = await import("../wa-webhook-profile/wallet/home.ts");
          handled = await startWallet(ctx, state ?? { key: "home" });
        }

        // Back to Profile (delegate to profile webhook)
        else if (id === IDS.BACK_PROFILE) {
          // Return to profile service - just show wallet home for now
          const { startWallet } = await import("../wa-webhook-profile/wallet/home.ts");
          handled = await startWallet(ctx, state ?? { key: "home" });
        }
      }
    }

    // Handle Text Messages
    else if (message.type === "text") {
      const text = (message.text as any)?.body?.toLowerCase() ?? "";
      const originalText = (message.text as any)?.body?.trim() ?? "";
      const upperText = originalText.toUpperCase();

      // PRIORITY: Check for referral code
      const refMatch = originalText.match(/^REF[:\s]+([A-Z0-9]{4,12})$/i);
      const isStandaloneCode = /^[A-Z0-9]{6,12}$/.test(upperText) &&
                              !/^(HELLO|THANKS|CANCEL|SUBMIT|ACCEPT|REJECT|STATUS|URGENT|PLEASE|PROFILE|WALLET)$/.test(upperText);

      if (refMatch || isStandaloneCode) {
        const code = refMatch ? refMatch[1] : originalText;
        logEvent("WALLET_REFERRAL_CODE_DETECTED", { code: code.substring(0, 4) + "***" });
        const { applyReferralCodeFromMessage } = await import("../wa-webhook-profile/wallet/referral.ts");
        handled = await applyReferralCodeFromMessage(ctx, code);
      }
      // Wallet keywords
      else if (text.includes("wallet") || text.includes("balance")) {
        const { startWallet } = await import("../wa-webhook-profile/wallet/home.ts");
        handled = await startWallet(ctx, state ?? { key: "home" });
      } else if (text.includes("transfer") || text.includes("send")) {
        const { startWalletTransfer } = await import("../wa-webhook-profile/wallet/transfer.ts");
        handled = await startWalletTransfer(ctx);
      } else if (text.includes("redeem") || text.includes("reward")) {
        const { showWalletRedeem } = await import("../wa-webhook-profile/wallet/redeem.ts");
        handled = await showWalletRedeem(ctx);
      } else if (text.includes("earn") || text.includes("get token")) {
        const { showWalletEarn } = await import("../wa-webhook-profile/wallet/earn.ts");
        handled = await showWalletEarn(ctx);
      } else if (text.includes("share") || text.includes("referral")) {
        const { handleWalletReferral } = await import("../wa-webhook-profile/wallet/referral.ts");
        handled = await handleWalletReferral(ctx);
      } else if (text.includes("transaction") || text.includes("history")) {
        const { showWalletTransactions } = await import("../wa-webhook-profile/wallet/transactions.ts");
        handled = await showWalletTransactions(ctx);
      }

      // Purchase keywords
      else if (["buy", "buy tokens", "purchase", "purchase tokens"].includes(text)) {
        const { handleWalletPurchase } = await import("../wa-webhook-profile/wallet/purchase.ts");
        handled = await handleWalletPurchase(ctx);
      }

      // Cash-out keywords
      else if (["cash out", "cashout", "withdraw", "withdrawal"].includes(text)) {
        const { handleCashOut } = await import("../wa-webhook-profile/wallet/cashout.ts");
        handled = await handleCashOut(ctx);
      }

      // MOMO QR Text
      else if (state?.key?.startsWith("momo_qr") || text.includes("momo") || text.includes("qr")) {
        const { handleMomoText, startMomoQr } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        if (state?.key?.startsWith("momo_qr")) {
          handled = await handleMomoText(ctx, (message.text as any)?.body ?? "", state);
        } else {
          handled = await startMomoQr(ctx, state ?? { key: "home" });
        }
      }

      // Wallet Transfer state handler
      else if (state?.key === IDS.WALLET_TRANSFER || state?.key === "wallet_transfer") {
        const { handleWalletTransferText } = await import("../wa-webhook-profile/wallet/transfer.ts");
        handled = await handleWalletTransferText(ctx, (message.text as any)?.body ?? "", state as any);
      }

      // Wallet Referral state handler
      else if (state?.key === IDS.WALLET_REFERRAL || state?.key === "wallet_referral") {
        const { applyReferralCodeFromMessage } = await import("../wa-webhook-profile/wallet/referral.ts");
        handled = await applyReferralCodeFromMessage(ctx, (message.text as any)?.body ?? "");
      }

      // Handle purchase amount input
      else if (state?.key === "wallet_purchase_amount") {
        const { handlePurchaseAmount } = await import("../wa-webhook-profile/wallet/purchase.ts");
        handled = await handlePurchaseAmount(ctx, text);
      }

      // Handle cash-out amount input
      else if (state?.key === "wallet_cashout_amount") {
        const { handleCashOutAmount } = await import("../wa-webhook-profile/wallet/cashout.ts");
        handled = await handleCashOutAmount(ctx, text);
      }

      // Handle cash-out phone input
      else if (state?.key === "wallet_cashout_phone") {
        const { handleCashOutPhone } = await import("../wa-webhook-profile/wallet/cashout.ts");
        handled = await handleCashOutPhone(ctx, text);
      }
    }

    // Fallback: Phone number pattern for MoMo QR
    if (!handled && message.type === "text") {
      const text = (message.text as any)?.body?.trim() ?? "";
      const phonePattern = /^(\+?\d{10,15}|\d{9,10})$/;
      if (phonePattern.test(text.replace(/[\s\-]/g, ''))) {
        const { handleMomoText } = await import("../_shared/wa-webhook-shared/flows/momo/qr.ts");
        handled = await handleMomoText(ctx, text, state ?? { key: "home" });
      }
    }

    if (!handled) {
      logEvent("WALLET_UNHANDLED_MESSAGE", { from, type: message.type });
      // Show wallet home as fallback
      const { startWallet } = await import("../wa-webhook-profile/wallet/home.ts");
      handled = await startWallet(ctx, state ?? { key: "home" });
    }

    return respond({ success: true, handled });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent("WALLET_WEBHOOK_ERROR", { error: message }, "error");
    await logStructuredEvent("ERROR", { data: "wallet.webhook_error", message });

    return respond({
      error: "internal_error",
      service: SERVICE_NAME,
      requestId,
    }, {
      status: 500,
    });
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: SERVICE_NAME,
  version: SERVICE_VERSION,
});
