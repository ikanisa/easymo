import { notifyWalletTransferRecipient } from "./notifications.ts";
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendButtonsMessage, sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";
import { toE164 } from "../../_shared/wa-webhook-shared/utils/phone.ts";
import { listWalletPartners, fetchWalletSummary } from "../../_shared/wa-webhook-shared/rpc/wallet.ts";
import { validateTransfer, checkFraudRisk } from "./security.ts";

type TransferState = {
  key: string;
  data?: {
    stage: "choose" | "recipient" | "amount";
    to?: string;
    idem?: string;
    partners?: Array<{ id: string; whatsapp?: string | null; name?: string | null }>;
  };
};

export async function startWalletTransfer(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Check balance - minimum 2000 tokens required
  let currentBalance = 0;
  try {
    const summary = await fetchWalletSummary(ctx.supabase, ctx.profileId);
    currentBalance = Number(summary?.tokens ?? 0);
  } catch (_) {
    currentBalance = 0;
  }
  
  if (currentBalance < 2000) {
    await sendButtonsMessage(
      ctx,
      `⚠️ You need at least 2000 tokens to transfer. Your balance: ${currentBalance}.`,
      [{ id: IDS.WALLET, title: "💎 Wallet" }],
    );
    return true;
  }
  
  const idem = crypto.randomUUID();
  await setState(ctx.supabase, ctx.profileId, {
    key: "wallet_transfer",
    data: { stage: "choose", idem },
  });
  try {
    const partners = await listWalletPartners(ctx.supabase, 10);
    await setState(ctx.supabase, ctx.profileId, {
      key: "wallet_transfer",
      data: {
        stage: "choose",
        idem,
        partners: partners.map((p) => ({
          id: p.id,
          whatsapp: p.whatsapp_e164 ?? null,
          name: p.name ?? null,
        })),
      },
    });
    const rows = [
      ...partners.map((p) => ({ id: `partner::${p.id}`, title: p.name ?? "Partner", description: p.whatsapp_e164 ?? undefined })),
      { id: "manual_recipient", title: "Enter number manually", description: "Type +countrycode and number" },
      { id: IDS.BACK_MENU, title: "← Back", description: "Return" },
    ];
    await sendListMessage(
      ctx,
      { title: "Transfer tokens", body: "Choose a partner or enter a number.", sectionTitle: "Recipients", rows, buttonText: "Select" },
      { emoji: "💎" },
    );
  } catch {
    await setState(ctx.supabase, ctx.profileId, {
      key: "wallet_transfer",
      data: { stage: "recipient", idem },
    });
    await sendButtonsMessage(
      ctx,
      "Send the recipient's WhatsApp number (e.g., +2507…).",
      [{ id: IDS.BACK_MENU, title: "Cancel" }],
    );
  }
  return true;
}

export async function handleWalletTransferSelection(
  ctx: RouterContext,
  state: TransferState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== "wallet_transfer") return false;
  const data = state.data ?? { stage: "choose" };
  if (id === "manual_recipient") {
    await setState(ctx.supabase, ctx.profileId, {
      key: "wallet_transfer",
      data: { stage: "recipient", idem: data.idem, partners: data.partners },
    });
    await sendButtonsMessage(
      ctx,
      "Send the recipient's WhatsApp number (e.g., +2507…).",
      [{ id: IDS.BACK_MENU, title: "Cancel" }],
    );
    return true;
  }
  if (id.startsWith("partner::")) {
    const partnerId = id.replace("partner::", "");
    const partner = data.partners?.find((p) => p.id === partnerId);
    if (!partner || !partner.whatsapp) {
      await sendButtonsMessage(
        ctx,
        "Partner details missing. Enter the number manually.",
        [{ id: IDS.BACK_MENU, title: "Cancel" }],
      );
      return true;
    }
    const to = toE164(partner.whatsapp);
    await setState(ctx.supabase, ctx.profileId, {
      key: "wallet_transfer",
      data: { stage: "amount", to, idem: data.idem, partners: data.partners },
    });
    await sendButtonsMessage(
      ctx,
      `How many tokens to send to ${partner.name ?? "this partner"}?`,
      [{ id: IDS.BACK_MENU, title: "Cancel" }],
    );
    return true;
  }
  return false;
}

export async function handleWalletTransferText(
  ctx: RouterContext,
  body: string,
  state: TransferState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== "wallet_transfer") return false;
  const data = state.data || { stage: "recipient" };
  if (data.stage === "choose") {
    // If the user typed instead of selecting, treat as manual
    const to = toE164(body);
    if (/^\+\d{6,15}$/.test(to)) {
      await setState(ctx.supabase, ctx.profileId, {
        key: "wallet_transfer",
        data: { stage: "amount", to, idem: data.idem, partners: data.partners },
      });
      await sendButtonsMessage(
        ctx,
        "How many tokens to send? Enter a number.",
        [{ id: IDS.BACK_MENU, title: "Cancel" }],
      );
      return true;
    }
    return false;
  }
  if (data.stage === "recipient") {
    const to = toE164(body);
    if (!/^\+\d{6,15}$/.test(to)) {
      await sendButtonsMessage(
        ctx,
        "Invalid number. Send +countrycode and number (e.g., +2507…).",
        [{ id: IDS.BACK_MENU, title: "Cancel" }],
      );
      return true;
    }
    await setState(ctx.supabase, ctx.profileId, {
      key: "wallet_transfer",
      data: { stage: "amount", to, idem: data.idem, partners: data.partners },
    });
    await sendButtonsMessage(
      ctx,
      "How many tokens to send? Enter a number.",
      [{ id: IDS.BACK_MENU, title: "Cancel" }],
    );
    return true;
  }
  if (data.stage === "amount") {
    const amount = parseInt(body.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendButtonsMessage(
        ctx,
        "Enter a positive number of tokens.",
        [{ id: IDS.BACK_MENU, title: "Cancel" }],
      );
      return true;
    }
    
    // Validate transfer amount and limits
    const validation = await validateTransfer(ctx, amount, ctx.profileId!);
    if (!validation.valid) {
      await sendButtonsMessage(
        ctx,
        `❌ ${validation.error}`,
        [{ id: IDS.WALLET, title: "💎 Back to Wallet" }],
      );
      return true;
    }
    
    try {
      // Resolve recipient profile by WhatsApp
      const { data: recipient } = await ctx.supabase
        .from("profiles")
        .select("user_id")
        .eq("whatsapp_e164", data.to as string)
        .maybeSingle();
      if (!recipient?.user_id) {
        await sendButtonsMessage(ctx, "Recipient not found.", [{ id: IDS.WALLET, title: "💎 Wallet" }]);
        return true;
      }
      
      // Check fraud risk
      const fraudCheck = await checkFraudRisk(ctx, ctx.profileId!, amount, recipient.user_id);
      if (fraudCheck.risky) {
        await sendButtonsMessage(
          ctx,
          `⚠️ Transfer blocked: ${fraudCheck.reason}\n\nPlease contact support if you believe this is an error.`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
        return true;
      }

      // Enforce 2000-min eligibility and sufficient balance
      let senderTokens = 0;
      try {
        const summary = await fetchWalletSummary(ctx.supabase, ctx.profileId);
        senderTokens = Number(summary?.tokens ?? 0);
      } catch (error) {
        console.error(JSON.stringify({
          event: "WALLET_SUMMARY_FETCH_FAILED",
          error: error instanceof Error ? error.message : String(error),
          profileId: ctx.profileId
        }));
        // Continue with senderTokens = 0, which will trigger the minimum balance check
      }
      if (senderTokens < 2000) {
        await sendButtonsMessage(
          ctx,
          `⚠️ You need at least 2000 tokens to transfer. Your balance: ${senderTokens}.`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
        return true;
      }
      if (amount > senderTokens) {
        await sendButtonsMessage(
          ctx,
          `⚠️ Insufficient balance. You have ${senderTokens} tokens.`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
        return true;
      }

      // Execute transfer via wallet_transfer_tokens (core engine)
      const idempotencyKey = data.idem ?? crypto.randomUUID();
      const { data: result2, error: err2 } = await ctx.supabase.rpc("wallet_transfer_tokens", {
        p_sender: ctx.profileId,
        p_amount: amount,
        p_recipient: recipient.user_id,
        p_idempotency_key: idempotencyKey,
      });
      
      if (err2) {
        console.error(JSON.stringify({
          event: "WALLET_TRANSFER_RPC_ERROR",
          error: err2.message,
          details: err2.details,
          hint: err2.hint,
          code: err2.code,
          sender: ctx.profileId,
          recipient: recipient.user_id,
          amount
        }));
        throw err2;
      }
      
      // RPC returns array, get first row
      const result = Array.isArray(result2) ? result2[0] : result2;
      const ok = result?.success === true;
      if (ok) {
        console.log(JSON.stringify({
          event: "WALLET_TRANSFER_SUCCESS",
          sender: ctx.profileId,
          recipient: recipient.user_id,
          amount,
          transfer_id: result?.transfer_id,
          sender_tokens: result?.sender_tokens,
          recipient_tokens: result?.recipient_tokens,
          idempotency_key: idempotencyKey
        }));
        
        await sendButtonsMessage(
          ctx,
          `✅ Sent ${amount} tokens to ${data.to}.`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
        
        // Fetch sender's name for notification
        const { data: senderProfile } = await ctx.supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", ctx.profileId)
          .single();
        const senderName = senderProfile?.display_name || "A friend";
        
        // Send notification to recipient
        notifyWalletTransferRecipient(ctx.supabase, recipient.user_id, amount, senderName)
          .catch((err) => {
            console.error(JSON.stringify({
              event: "WALLET_TRANSFER_NOTIFICATION_FAILED",
              error: err instanceof Error ? err.message : String(err),
              recipient: recipient.user_id
            }));
          });
      } else {
        console.error(JSON.stringify({
          event: "WALLET_TRANSFER_REJECTED",
          sender: ctx.profileId,
          recipient: recipient.user_id,
          amount,
          reason: result?.reason || "unknown"
        }));
        
        await sendButtonsMessage(
          ctx,
          `❌ Transfer failed: ${result?.reason || "Unknown error"}`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
      }
      
      const { clearState } = await import("../../_shared/wa-webhook-shared/state/store.ts");
      await clearState(ctx.supabase, ctx.profileId);
      return true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({
        event: "WALLET_TRANSFER_FAILED",
        error: errorMsg,
        sender: ctx.profileId,
        recipient: data.to,
        amount,
        idempotency_key: data.idem
      }));
      
      await sendButtonsMessage(
        ctx,
        `❌ Transfer failed: ${errorMsg}\n\nPlease try again or contact support.`,
        [{ id: IDS.WALLET, title: "💎 Wallet" }],
      );
      return true;
    }
  }
  return false;
}
