import { notifyWalletTransferRecipient } from "./notifications.ts";
import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";
import { toE164 } from "../../utils/phone.ts";
import { listWalletPartners } from "../../rpc/wallet.ts";

type TransferState = {
  key: string;
  data?: {
    stage: "choose" | "recipient" | "amount";
    to?: string;
    idem?: string;
  };
};

export async function startWalletTransfer(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Check balance - minimum 2000 tokens required
  const { data: balance } = await ctx.supabase.rpc("wallet_get_balance", { p_user_id: ctx.profileId });
  const currentBalance = typeof balance === "number" ? balance : 0;
  
  if (currentBalance < 2000) {
    await sendButtonsMessage(
      ctx,
      `⚠️ You need at least 2000 tokens to transfer. Your balance: ${currentBalance}.`,
      [{ id: IDS.WALLET, title: "💎 Wallet" }],
    );
    return true;
  }
  
  const idem = crypto.randomUUID();
  await setState(ctx.supabase, ctx.profileId, { key: "wallet_transfer", data: { stage: "choose", idem } });
  try {
    const partners = await listWalletPartners(ctx.supabase, 10);
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
    await setState(ctx.supabase, ctx.profileId, { key: "wallet_transfer", data: { stage: "recipient", idem } });
    await sendButtonsMessage(
      ctx,
      "Send the recipient's WhatsApp number (e.g., +2507…).",
      [{ id: IDS.BACK_MENU, title: "Cancel" }],
    );
  }
  return true;
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
      await setState(ctx.supabase, ctx.profileId, { key: "wallet_transfer", data: { stage: "amount", to, idem: data.idem } });
      await sendButtonsMessage(ctx, "How many tokens to send? Enter a number.", [{ id: IDS.BACK_MENU, title: "Cancel" }]);
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
      data: { stage: "amount", to, idem: data.idem },
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
    try {
      const { data: result, error } = await ctx.supabase.rpc(
        "wallet_transfer_tokens",
        {
          p_sender: ctx.profileId,
          p_recipient_whatsapp: data.to,
          p_amount: amount,
          p_idempotency_key: data.idem ?? crypto.randomUUID(),
        },
      );
      if (error) throw error;
      const row = Array.isArray(result) ? result[0] : result;
      if (row?.success) {
        await sendButtonsMessage(
          ctx,
          `✅ Sent ${amount} tokens to ${data.to}.`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );

        // Notify recipient
        if (row.transfer_id) {
           const { data: transfer } = await ctx.supabase
             .from("wallet_transfers")
             .select("recipient_profile")
             .eq("id", row.transfer_id)
             .single();
             
           if (transfer?.recipient_profile) {
             notifyWalletTransferRecipient(ctx.supabase, transfer.recipient_profile, amount, "A friend").catch(console.error);
           }
        }
      } else {
        const reason = row?.reason || "failed";
        await sendButtonsMessage(
          ctx,
          `Transfer failed: ${reason}.`,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
      }
      await setState(ctx.supabase, ctx.profileId, { key: "wallet_home", data: {} });
      return true;
    } catch (e) {
      await sendButtonsMessage(
        ctx,
        "Could not transfer tokens. Try later.",
        [{ id: IDS.WALLET, title: "💎 Wallet" }],
      );
      return true;
    }
  }
  return false;
}
