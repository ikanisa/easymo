import { logStructuredEvent } from "../../_shared/observability.ts";
import { maskPhone, normalizePhone } from "../../_shared/phone-utils.ts";
import type { SupabaseClient } from "../../_shared/wa-webhook-shared/deps.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import {
  clearState,
  setState,
} from "../../_shared/wa-webhook-shared/state/store.ts";
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendTextMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";

const STATE_WALLET_NUMBER = "WALLET_WAIT_NUMBER";
const STATE_WALLET_AMOUNT = "WALLET_WAIT_AMOUNT";

/**
 * Wallet - Transfer Tokens ONLY (TWO STEPS)
 * Step 1: Get recipient number
 * Step 2: Get amount and execute transfer
 */
export async function handleWallet(
  ctx: RouterContext,
  text: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Step 1: Prompt for recipient number
  if (state.key !== STATE_WALLET_NUMBER && state.key !== STATE_WALLET_AMOUNT) {
    return await promptRecipientNumber(ctx);
  }

  // Step 1: Validate and store recipient number
  if (state.key === STATE_WALLET_NUMBER) {
    const recipient = normalizePhone(text);

    if (!recipient) {
      await sendTextMessage(
        ctx,
        `❌ *Invalid Number Format*\n\n` +
          `I couldn't recognize that number. 😔\n\n` +
          `*Please send a valid WhatsApp number:*\n` +
          `• Format: +250788123456 or 0788123456\n\n` +
          `*Examples:*\n` +
          `• +250788123456\n` +
          `• 0788123456\n\n` +
          `Try again! 💪`,
      );
      return true;
    }

    // Check if sending to self
    if (recipient === normalizePhone(ctx.from)) {
      await sendTextMessage(
        ctx,
        `😅 *Can't Send to Yourself*\n\n` +
          `You cannot send tokens to your own number!\n\n` +
          `Please enter a different recipient number. 👥`,
      );
      return await promptRecipientNumber(ctx);
    }

    await setState(ctx.supabase, ctx.profileId, {
      key: STATE_WALLET_AMOUNT,
      data: { recipient },
    });

    // Get sender balance
    const balance = await getBalance(ctx);

    await sendTextMessage(
      ctx,
      `💰 *Enter Amount*\n\n` +
        `How many tokens do you want to send to ${maskPhone(recipient)}?\n\n` +
        `Your balance: *${balance} TOK*\n\n` +
        `💡 Enter a number (e.g., 10, 50, 100)`,
    );
    return true;
  }

  // Step 2: Validate amount and execute transfer
  if (state.key === STATE_WALLET_AMOUNT) {
    const recipient = state.data?.recipient as string;
    if (!recipient) {
      await clearState(ctx.supabase, ctx.profileId);
      return await promptRecipientNumber(ctx);
    }

    const amount = parseInt(text.trim().replace(/\D/g, ""), 10);

    if (isNaN(amount) || amount <= 0) {
      await sendTextMessage(
        ctx,
        `❌ *Invalid Amount*\n\n` +
          `Please send a valid number.\n\n` +
          `*Examples:*\n` +
          `• 10\n` +
          `• 50\n` +
          `• 100\n\n` +
          `💡 Enter only the number (no text or symbols)`,
      );
      return true;
    }

    // Get sender balance
    const balance = await getBalance(ctx);

    if (amount > balance) {
      await sendTextMessage(
        ctx,
        `❌ *Insufficient Balance*\n\n` +
          `You tried to send *${amount} tokens*, but you only have *${balance} TOK*.\n\n` +
          `💡 Please enter a smaller amount (max: ${balance} tokens)`,
      );
      return true;
    }

    // Execute transfer
    const result = await executeTransfer(ctx, recipient, amount);

    if (result.success) {
      await clearState(ctx.supabase, ctx.profileId);
      await sendTextMessage(
        ctx,
        `✅ *Transfer Successful!*\n\n` +
          `Sent *${amount} tokens* to ${maskPhone(recipient)}.\n\n` +
          `Your new balance: *${result.newBalance} TOK*\n\n` +
          `💡 The recipient has been notified!`,
      );
    } else {
      await sendTextMessage(
        ctx,
        `❌ *Transfer Failed*\n\n` +
          `Sorry, the transfer couldn't be completed.\n\n` +
          `*Error:* ${result.error}\n\n` +
          `💡 Please try again, or contact support if the problem persists.`,
      );
    }

    return true;
  }

  return false;
}

/**
 * Prompt for recipient number (Step 1)
 */
async function promptRecipientNumber(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  const balance = await getBalance(ctx);

  if (balance === 0) {
    await sendTextMessage(
      ctx,
      "⚠️ You don't have any tokens to transfer.\n\nEarn tokens by sharing easyMO with your contacts!",
    );
    return true;
  }

  await setState(ctx.supabase, ctx.profileId, {
    key: STATE_WALLET_NUMBER,
    data: {},
  });

  await sendTextMessage(
    ctx,
    `💰 *Transfer Tokens*\n\n` +
      `Your current balance: *${balance} TOK*\n\n` +
      `📱 *Send Recipient Number*\n` +
      `Enter the WhatsApp number of the person you want to send tokens to.\n\n` +
      `*Examples:*\n` +
      `• +250788123456\n` +
      `• 0788123456\n\n` +
      `💡 They'll receive a notification when tokens arrive!`,
  );

  return true;
}

/**
 * Execute token transfer
 */
async function executeTransfer(
  ctx: RouterContext,
  recipientPhone: string,
  amount: number,
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  if (!ctx.profileId) return { success: false, error: "No profile ID" };

  try {
    // Ensure recipient profile exists
    // Try both wa_id and phone_number
    const normalizedPhone = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
    const waId = recipientPhone.replace(/^\+/, '');
    
    const { data: recipientProfile } = await ctx.supabase
      .from("profiles")
      .select("user_id")
      .or(`wa_id.eq.${waId},phone_number.eq.${normalizedPhone},phone_number.eq.${recipientPhone}`)
      .maybeSingle();

    let recipientId: string;

    if (recipientProfile?.user_id) {
      recipientId = recipientProfile.user_id;
    } else {
      // Recipient profile not found - return error
      // Profile creation should go through ensureProfile in the main handler
      return { 
        success: false, 
        error: "Recipient profile not found. Please ensure the recipient has an account." 
      };
    }

    // Generate transfer reference ID for idempotency
    const transferRef =
      `transfer_${ctx.profileId}_${recipientId}_${Date.now()}`;

    // Check if transfer already processed (idempotency)
    const { data: existing } = await ctx.supabase
      .from("token_transfers")
      .select("id, status")
      .eq("from_user_id", ctx.profileId)
      .eq("to_user_id", recipientId)
      .eq("amount", amount)
      .gte("created_at", new Date(Date.now() - 60000).toISOString()) // Last minute
      .maybeSingle();

    if (existing && existing.status === "completed") {
      const balance = await getBalance(ctx);
      return { success: true, newBalance: balance };
    }

    // Execute transfer in transaction (debit sender, credit recipient)
    const { error: debitError } = await ctx.supabase.rpc("wallet_delta_fn", {
      p_profile_id: ctx.profileId,
      p_amount_tokens: -amount,
      p_entry_type: "transfer_out",
      p_reference_table: "token_transfers",
      p_description: `Transfer to ${maskPhone(recipientPhone)}`,
    });

    if (debitError) {
      return { success: false, error: debitError.message };
    }

    const { error: creditError } = await ctx.supabase.rpc("wallet_delta_fn", {
      p_profile_id: recipientId,
      p_amount_tokens: amount,
      p_entry_type: "transfer_in",
      p_reference_table: "token_transfers",
      p_description: `Transfer from ${maskPhone(ctx.from)}`,
    });

    if (creditError) {
      // Rollback: credit back to sender
      await ctx.supabase.rpc("wallet_delta_fn", {
        p_profile_id: ctx.profileId,
        p_amount_tokens: amount,
        p_entry_type: "transfer_rollback",
        p_description: "Rollback failed transfer",
      });
      return { success: false, error: "Failed to credit recipient" };
    }

    // Record transfer
    await ctx.supabase.from("token_transfers").insert({
      from_user_id: ctx.profileId,
      to_user_id: recipientId,
      amount,
      status: "completed",
      client_ref: transferRef,
    });

    // Send notification to recipient
    try {
      const recipientBalance = await getBalanceForUser(
        ctx.supabase,
        recipientId,
      );
      await sendText(
        recipientPhone,
        `🎉 *Tokens Received!*\n\n` +
          `You received *${amount} tokens* from ${maskPhone(ctx.from)}!\n\n` +
          `Your new balance: *${recipientBalance} TOK*\n\n` +
          `💡 Use tokens to access premium features on easyMO!`,
      );
    } catch {
      // Non-fatal - notification failed but transfer succeeded
      await ctx.supabase
        .from("token_transfers")
        .update({ status: "failed_notify" })
        .eq("client_ref", transferRef);
    }

    const newBalance = await getBalance(ctx);

    await logStructuredEvent("WALLET_TRANSFER_SUCCESS", {
      fromUserId: ctx.profileId,
      toUserId: recipientId,
      amount,
      newBalance,
    });

    return { success: true, newBalance };
  } catch (error) {
    await logStructuredEvent("WALLET_TRANSFER_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return { success: false, error: "Transfer failed" };
  }
}

/**
 * Get wallet balance for current user
 */
async function getBalance(ctx: RouterContext): Promise<number> {
  if (!ctx.profileId) return 0;
  return await getBalanceForUser(ctx.supabase, ctx.profileId);
}

/**
 * Get wallet balance for any user
 * Uses wallet_accounts table (column: tokens, key: profile_id)
 */
async function getBalanceForUser(
  supabase: SupabaseClient,
  profileId: string,
): Promise<number> {
  try {
    const { data } = await supabase
      .from("wallet_accounts")
      .select("tokens")
      .eq("profile_id", profileId)
      .maybeSingle();

    return data?.tokens || 0;
  } catch (error) {
    // If table doesn't exist yet, return 0 (will be created by migration)
    logStructuredEvent("WALLET_BALANCE_QUERY_ERROR", {
      profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return 0;
  }
}

// normalizePhone is now imported from shared phone-utils
