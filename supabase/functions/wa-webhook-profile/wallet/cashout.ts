import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, getState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendText, sendButtonsMessage } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const CASHOUT_STATES = {
  AMOUNT: "wallet_cashout_amount",
  PHONE: "wallet_cashout_phone",
  CONFIRM: "wallet_cashout_confirm"
};

const MIN_CASHOUT = 1000; // tokens
const CASHOUT_FEE_PERCENT = 0.02; // 2% fee
const TOKEN_TO_RWF_RATE = 0.5; // 1 token = 0.5 RWF

export async function handleCashOut(ctx: RouterContext): Promise<boolean> {
  // Check balance
  const { data: wallet, error } = await ctx.supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", ctx.profileId)
    .single();

  if (error || !wallet) {
    await sendText(ctx.from, "❌ Error checking balance. Please try again.");
    return false;
  }

  if (wallet.balance < MIN_CASHOUT) {
    await sendText(ctx.from,
      `❌ *Minimum Cash-Out: ${MIN_CASHOUT.toLocaleString()} tokens*\n\n` +
      `Your balance: ${wallet.balance.toLocaleString()} tokens\n\n` +
      `Earn more tokens to cash out!`
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId!, {
    key: CASHOUT_STATES.AMOUNT,
    data: { maxBalance: wallet.balance }
  });

  await logStructuredEvent("WALLET_CASHOUT_START", {
    userId: ctx.profileId,
    balance: wallet.balance
  });

  await sendText(ctx.from,
    `💸 *Cash Out Tokens*\n\n` +
    `Your balance: ${wallet.balance.toLocaleString()} tokens\n` +
    `Minimum: ${MIN_CASHOUT.toLocaleString()} tokens\n` +
    `Fee: 2%\n` +
    `Rate: 1 token = 0.5 RWF\n\n` +
    `How many tokens do you want to cash out?\n\n` +
    `Type the amount or 'cancel' to go back.`
  );

  return true;
}

export async function handleCashOutAmount(
  ctx: RouterContext,
  amountStr: string
): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { maxBalance } = state?.data || {};

  const amount = parseInt(amountStr.replace(/[^0-9]/g, ""));

  if (isNaN(amount) || amount < MIN_CASHOUT) {
    await sendText(ctx.from, `❌ Minimum cash-out: ${MIN_CASHOUT.toLocaleString()} tokens`);
    return true;
  }

  if (amount > maxBalance) {
    await sendText(ctx.from,
      `❌ Insufficient balance.\n\n` +
      `You have: ${maxBalance.toLocaleString()} tokens\n` +
      `Requested: ${amount.toLocaleString()} tokens`
    );
    return true;
  }

  const fee = Math.ceil(amount * CASHOUT_FEE_PERCENT);
  const netTokens = amount - fee;
  const rwfAmount = netTokens * TOKEN_TO_RWF_RATE;

  await setState(ctx.supabase, ctx.profileId!, {
    key: CASHOUT_STATES.PHONE,
    data: { amount, fee, netTokens, rwfAmount }
  });

  await sendText(ctx.from,
    `📱 *Enter Mobile Money Number*\n\n` +
    `💰 Summary:\n` +
    `Tokens: ${amount.toLocaleString()}\n` +
    `Fee (2%): ${fee.toLocaleString()} tokens\n` +
    `Net: ${netTokens.toLocaleString()} tokens\n` +
    `Cash: ${rwfAmount.toLocaleString()} RWF\n\n` +
    `Enter your mobile money number:\n` +
    `Format: 078XXXXXXX or 079XXXXXXX\n\n` +
    `Cash will be sent via USSD to this number.`
  );

  return true;
}

export async function handleCashOutPhone(
  ctx: RouterContext,
  phone: string
): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { amount, fee, netTokens, rwfAmount } = state?.data || {};

  // Validate required state data
  if (!amount || !fee || !netTokens || !rwfAmount) {
    await sendText(ctx.from, "❌ Session expired. Please start again.");
    return false;
  }

  // Validate and normalize phone
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  
  // Support Rwanda MTN (078) and Airtel (073, 072) numbers
  // Also support format with country code prefix
  let normalizedPhone = cleanPhone;
  let formattedPhone: string;
  
  // Handle cases where user includes country code
  if (cleanPhone.startsWith("250") && cleanPhone.length === 12) {
    normalizedPhone = cleanPhone.slice(3);
  }
  
  // Validate Rwanda mobile number format (078, 079, 073, 072)
  if (!/^0?(78|79|73|72)\d{7}$/.test(normalizedPhone)) {
    await sendText(ctx.from,
      "❌ Invalid mobile money number.\n\n" +
      "Supported formats:\n" +
      "• MTN: 078XXXXXXX or 079XXXXXXX\n" +
      "• Airtel: 072XXXXXXX or 073XXXXXXX"
    );
    return true;
  }
  
  // Ensure we have the leading 0
  if (!normalizedPhone.startsWith("0")) {
    normalizedPhone = "0" + normalizedPhone;
  }
  
  formattedPhone = `+250${normalizedPhone.slice(1)}`;

  await setState(ctx.supabase, ctx.profileId!, {
    key: CASHOUT_STATES.CONFIRM,
    data: { amount, fee, netTokens, rwfAmount, momoPhone: formattedPhone }
  });

  await sendButtonsMessage(ctx,
    `💸 *Confirm Cash-Out*\n\n` +
    `Tokens to withdraw: ${amount.toLocaleString()}\n` +
    `Processing fee (2%): ${fee.toLocaleString()} tokens\n` +
    `Net tokens: ${netTokens.toLocaleString()}\n` +
    `Cash amount: ${rwfAmount.toLocaleString()} RWF\n\n` +
    `Mobile Money: ${formattedPhone}\n\n` +
    `⚠️ This will deduct ${amount.toLocaleString()} tokens from your wallet.\n\n` +
    `Cash will be sent via USSD within 1-24 hours.\n\n` +
    `Confirm withdrawal?`,
    [
      { id: "cashout_confirm_yes", title: "✅ Confirm" },
      { id: "cashout_confirm_no", title: "❌ Cancel" }
    ]
  );

  return true;
}

export async function handleCashOutConfirm(ctx: RouterContext): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { amount, fee, netTokens, rwfAmount, momoPhone } = state?.data || {};

  try {
    // Create cashout record
    const { data: cashout, error: insertError } = await ctx.supabase
      .from("wallet_cashouts")
      .insert({
        user_id: ctx.profileId,
        user_wa_id: ctx.from,
        token_amount: amount,
        fee_amount: fee,
        net_tokens: netTokens,
        rwf_amount: rwfAmount,
        momo_number: momoPhone,
        status: "pending"
      })
      .select()
      .single();

    if (insertError || !cashout) {
      await logStructuredEvent("WALLET_CASHOUT_CREATE_ERROR", {
        userId: ctx.profileId,
        error: insertError?.message
      }, "error");

      await sendText(ctx.from, "❌ Error creating cash-out request. Please try again.");
      return false;
    }

    // Deduct tokens immediately using RPC
    const { error: debitError } = await ctx.supabase.rpc("wallet_debit_tokens", {
      p_user_id: ctx.profileId,
      p_amount: amount,
      p_reference_type: "cashout",
      p_reference_id: cashout.id,
      p_description: `Cash-out ${amount.toLocaleString()} tokens to ${momoPhone}`
    });

    if (debitError) {
      await logStructuredEvent("WALLET_CASHOUT_DEBIT_ERROR", {
        userId: ctx.profileId,
        cashoutId: cashout.id,
        error: debitError.message
      }, "error");

      // Rollback cashout record
      await ctx.supabase
        .from("wallet_cashouts")
        .update({ status: "failed" })
        .eq("id", cashout.id);

      await sendText(ctx.from, "❌ Insufficient balance or error processing withdrawal.");
      return false;
    }

    // Clear state
    await setState(ctx.supabase, ctx.profileId!, {
      key: "home",
      data: {}
    });

    const cashoutRef = cashout.id.slice(0, 8).toUpperCase();

    await sendText(ctx.from,
      `✅ *Cash-Out Request Submitted*\n\n` +
      `Reference: ${cashoutRef}\n` +
      `Amount: ${rwfAmount.toLocaleString()} RWF\n` +
      `Mobile Money: ${momoPhone}\n\n` +
      `⏱️ Processing time: 1-24 hours\n\n` +
      `You'll receive the cash via USSD transfer to your mobile money account.\n\n` +
      `${amount.toLocaleString()} tokens have been deducted from your wallet.`
    );

    await logStructuredEvent("WALLET_CASHOUT_REQUESTED", {
      userId: ctx.profileId,
      cashoutId: cashout.id,
      amount,
      rwfAmount,
      momoPhone
    });

    // TODO: Trigger admin notification or automated USSD disbursement
    // For now, admin will process manually via USSD

    return true;
  } catch (error) {
    await logStructuredEvent("WALLET_CASHOUT_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    await sendText(ctx.from, "❌ Unexpected error. Please try again later.");
    return false;
  }
}

export async function handleCashOutCancel(ctx: RouterContext): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId!, {
    key: "home",
    data: {}
  });

  await sendText(ctx.from, "❌ Cash-out cancelled.");
  return true;
}
