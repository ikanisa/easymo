import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendButtonsMessage, sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { toE164 } from "../../_shared/wa-webhook-shared/utils/phone.ts";
import { listWalletPartners, fetchWalletSummary } from "../../_shared/wa-webhook-shared/rpc/wallet.ts";

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
  console.log(JSON.stringify({
    event: "WALLET_TRANSFER_TEXT_HANDLER_CALLED",
    body_length: body.length,
    body_preview: body.substring(0, 50),
    state_key: state.key,
    stage: state.data?.stage,
    sender: ctx.profileId
  }));
  
  if (!ctx.profileId || state.key !== "wallet_transfer") {
    console.warn(JSON.stringify({
      event: "WALLET_TRANSFER_TEXT_HANDLER_SKIPPED",
      reason: !ctx.profileId ? "no_profile_id" : "wrong_state_key",
      state_key: state.key,
      expected_key: "wallet_transfer"
    }));
    return false;
  }
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
    console.log(JSON.stringify({
      event: "WALLET_TRANSFER_AMOUNT_INPUT",
      raw_body: body,
      sender: ctx.profileId,
      recipient: data.to,
      state_data: data
    }));
    
    const amount = parseInt(body.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn(JSON.stringify({
        event: "WALLET_TRANSFER_INVALID_AMOUNT",
        raw_body: body,
        parsed_amount: amount,
        sender: ctx.profileId
      }));
      await sendButtonsMessage(
        ctx,
        "Enter a positive number of tokens.",
        [{ id: IDS.BACK_MENU, title: "Cancel" }],
      );
      return true;
    }
    
    // Validate transfer amount and limits handled by transferTokens
    
    try {
      // Execute transfer using shared business logic
      const { transferTokens } = await import("../../_shared/wa-webhook-shared/wallet/transfer.ts");
      const result = await transferTokens(ctx, data.to as string, amount);

      if (result.success) {
        await sendButtonsMessage(
          ctx,
          result.message,
          [{ id: IDS.WALLET, title: "💎 Wallet" }],
        );
      } else {
        await sendButtonsMessage(
          ctx,
          result.message,
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
