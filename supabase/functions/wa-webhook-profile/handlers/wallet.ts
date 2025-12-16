import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { ensureReferralLink } from "../../_shared/wa-webhook-shared/utils/share.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { t } from "../../_shared/wa-webhook-shared/i18n/translator.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import {
  sendButtonsMessage,
  sendListMessage,
  sendTextMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";

const WALLET_STATE_HOME = "wallet_home";
const WALLET_STATE_TRANSFER_PARTNER = "wallet_transfer_partner";
const WALLET_STATE_TRANSFER_AMOUNT = "wallet_transfer_amount";

/**
 * Show wallet menu with balance, earn, and transfer options
 */
export async function showWalletMenu(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get wallet balance
  const { data: wallet } = await ctx.supabase
    .from("wallet_accounts")
    .select("tokens")
    .eq("profile_id", ctx.profileId)
    .maybeSingle();

  const balance = wallet?.tokens || 0;

  await setState(ctx.supabase, ctx.profileId, {
    key: WALLET_STATE_HOME,
    data: {},
  });

  const rows = [
    {
      id: "WALLET_EARN",
      title: "💰 Earn Tokens",
      description: "Share easyMO to earn tokens",
    },
    {
      id: "WALLET_TRANSFER",
      title: "💸 Transfer to Partner",
      description: "Send tokens to allowed partners",
    },
    {
      id: IDS.BACK_MENU,
      title: "← Back",
      description: "",
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: "💳 Wallet & Tokens",
      body: `Your balance: *${balance} TOK*\n\nEarn tokens by sharing easyMO with your contacts. Transfer tokens to allowed partners only.`,
      sectionTitle: "Options",
      buttonText: "Select",
      rows,
    },
  );

  await logStructuredEvent("WALLET_MENU_DISPLAYED", {
    userId: ctx.profileId,
    balance,
    locale: ctx.locale,
  });

  return true;
}

/**
 * Show earn tokens menu (share easyMO)
 */
export async function showEarnTokens(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

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
        { id: "WALLET", title: "← Back to Wallet" },
        { id: IDS.BACK_MENU, title: "🏠 Home" },
      ],
    );

    await logStructuredEvent("WALLET_EARN_SHOWN", {
      userId: ctx.profileId,
      code: link.code,
      locale: ctx.locale,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("WALLET_EARN_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "wallet.earn.error"),
      [
        { id: "WALLET", title: "← Back to Wallet" },
        { id: IDS.BACK_MENU, title: "🏠 Home" },
      ],
    );

    return true;
  }
}

/**
 * Show list of allowed partners for transfer
 */
export async function showTransferPartners(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get wallet balance
  const { data: wallet } = await ctx.supabase
    .from("wallet_accounts")
    .select("tokens")
    .eq("profile_id", ctx.profileId)
    .maybeSingle();

  const balance = wallet?.tokens || 0;

  if (balance === 0) {
    await sendTextMessage(
      ctx,
      "⚠️ You don't have any tokens to transfer. Earn tokens by sharing easyMO with your contacts.",
    );
    return true;
  }

  // Get allowed partners
  const { data: partners, error: partnersError } = await ctx.supabase
    .from("allowed_partners")
    .select("id, partner_name, partner_phone, partner_type, description")
    .eq("is_active", true)
    .order("partner_name");

  if (partnersError || !partners || partners.length === 0) {
    await sendTextMessage(
      ctx,
      "⚠️ No partners available for transfers at this time. Please check back later.",
    );
    await logStructuredEvent("WALLET_TRANSFER_NO_PARTNERS", {
      userId: ctx.profileId,
      error: partnersError?.message,
    }, "warn");
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: WALLET_STATE_TRANSFER_PARTNER,
    data: {},
  });

  const rows = partners.map((partner) => ({
    id: `TRANSFER_TO::${partner.id}`,
    title: partner.partner_name,
    description: `${partner.partner_type} | ${partner.description || ""}`,
  }));

  rows.push({
    id: "WALLET",
    title: "← Back to Wallet",
    description: "",
  });

  await sendListMessage(
    ctx,
    {
      title: "💸 Transfer Tokens",
      body: `Your balance: *${balance} TOK*\n\nSelect a partner to transfer tokens to:`,
      sectionTitle: "Partners",
      buttonText: "Select",
      rows,
    },
  );

  await logStructuredEvent("WALLET_TRANSFER_PARTNERS_SHOWN", {
    userId: ctx.profileId,
    partnerCount: partners.length,
    balance,
  });

  return true;
}

/**
 * Handle partner selection and prompt for amount
 */
export async function handlePartnerSelection(
  ctx: RouterContext,
  partnerId: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get partner details
  const { data: partner, error: partnerError } = await ctx.supabase
    .from("allowed_partners")
    .select("id, partner_name, partner_phone, partner_type")
    .eq("id", partnerId)
    .eq("is_active", true)
    .maybeSingle();

  if (partnerError || !partner) {
    await sendTextMessage(
      ctx,
      "⚠️ Partner not found or no longer available. Please select another partner.",
    );
    return showTransferPartners(ctx);
  }

  // Get wallet balance
  const { data: wallet } = await ctx.supabase
    .from("wallet_accounts")
    .select("tokens")
    .eq("profile_id", ctx.profileId)
    .maybeSingle();

  const balance = wallet?.tokens || 0;

  await setState(ctx.supabase, ctx.profileId, {
    key: WALLET_STATE_TRANSFER_AMOUNT,
    data: { partnerId: partner.id, partnerName: partner.partner_name },
  });

  await sendTextMessage(
    ctx,
    `💸 Transfer to: *${partner.partner_name}*\n\nYour balance: *${balance} TOK*\n\nHow many tokens do you want to transfer?\n\nSend a number (e.g., 10, 50, 100)`,
  );

  await logStructuredEvent("WALLET_TRANSFER_AMOUNT_PROMPT", {
    userId: ctx.profileId,
    partnerId: partner.id,
    balance,
  });

  return true;
}

/**
 * Process token transfer to partner
 */
export async function processTransfer(
  ctx: RouterContext,
  amountText: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId || !state.data) return false;

  const partnerId = state.data.partnerId as string;
  const partnerName = state.data.partnerName as string;

  // Parse amount
  const amount = parseInt(amountText.trim(), 10);
  if (isNaN(amount) || amount <= 0) {
    await sendTextMessage(
      ctx,
      "⚠️ Please send a valid number (e.g., 10, 50, 100).",
    );
    return true;
  }

  // Get wallet balance
  const { data: wallet, error: walletError } = await ctx.supabase
    .from("wallet_accounts")
    .select("tokens")
    .eq("profile_id", ctx.profileId)
    .maybeSingle();

  if (walletError || !wallet) {
    await sendTextMessage(
      ctx,
      "⚠️ Error accessing your wallet. Please try again.",
    );
    await logStructuredEvent("WALLET_TRANSFER_ERROR", {
      userId: ctx.profileId,
      error: walletError?.message || "Wallet not found",
    }, "error");
    return true;
  }

  const balance = wallet.tokens || 0;

  if (amount > balance) {
    await sendTextMessage(
      ctx,
      `⚠️ Insufficient balance. You have *${balance} TOK*. Please enter a smaller amount.`,
    );
    return true;
  }

  // Verify partner still exists and is active
  const { data: partner, error: partnerError } = await ctx.supabase
    .from("allowed_partners")
    .select("id, partner_name, partner_phone")
    .eq("id", partnerId)
    .eq("is_active", true)
    .maybeSingle();

  if (partnerError || !partner) {
    await sendTextMessage(
      ctx,
      "⚠️ Partner no longer available. Please select another partner.",
    );
    return showTransferPartners(ctx);
  }

  // Execute transfer using wallet_delta_fn
  const { error: transferError } = await ctx.supabase.rpc("wallet_delta_fn", {
    p_profile_id: ctx.profileId,
    p_amount_tokens: -amount, // Negative for debit
    p_entry_type: "partner_transfer",
    p_reference_table: "allowed_partners",
    p_reference_id: partner.id,
    p_description: `Transfer to ${partner.partner_name}`,
  });

  if (transferError) {
    await sendTextMessage(
      ctx,
      "⚠️ Transfer failed. Please try again.",
    );
    await logStructuredEvent("WALLET_TRANSFER_ERROR", {
      userId: ctx.profileId,
      partnerId: partner.id,
      amount,
      error: transferError.message,
    }, "error");
    return true;
  }

  // Get updated balance
  const { data: updatedWallet } = await ctx.supabase
    .from("wallet_accounts")
    .select("tokens")
    .eq("profile_id", ctx.profileId)
    .maybeSingle();

  const newBalance = updatedWallet?.tokens || 0;

  await sendTextMessage(
    ctx,
    `✅ Transfer successful!\n\n*${amount} TOK* transferred to ${partner.partner_name}\n\nNew balance: *${newBalance} TOK*`,
  );

  // Clear state
  await setState(ctx.supabase, ctx.profileId, {
    key: WALLET_STATE_HOME,
    data: {},
  });

  await logStructuredEvent("WALLET_TRANSFER_SUCCESS", {
    userId: ctx.profileId,
    partnerId: partner.id,
    partnerName: partner.partner_name,
    amount,
    oldBalance: balance,
    newBalance,
  });

  return true;
}
