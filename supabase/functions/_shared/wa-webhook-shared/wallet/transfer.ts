import type { RouterContext } from "../types.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { notifyTokenTransfer, notifyTransactionFailed } from "./notifications.ts";

export interface TransferResult {
  success: boolean;
  transferId?: string;
  error?: string;
  message: string;
}

/**
 * Transfer tokens between users
 */
export async function transferTokens(
  ctx: RouterContext,
  recipientPhone: string,
  amount: number,
  pin?: string
): Promise<TransferResult> {
  if (!ctx.profileId) {
    return {
      success: false,
      error: "unauthorized",
      message: "❌ Authentication required",
    };
  }

  // Validate amount
  if (amount <= 0) {
    return {
      success: false,
      error: "invalid_amount",
      message: "❌ Amount must be positive",
    };
  }

  try {
    // 1. Check limits
    const { data: limits, error: limitError } = await ctx.supabase.rpc("check_transfer_limits", {
      p_profile_id: ctx.profileId,
      p_amount: amount,
    });

    if (limitError) throw limitError;
    
    if (!limits[0].allowed) {
      return {
        success: false,
        error: "limit_exceeded",
        message: `❌ ${limits[0].reason}`,
      };
    }

    // 2. Find recipient
    const { data: recipient, error: recipientError } = await ctx.supabase
      .from("profiles")
      .select("id, name, phone_number")
      .eq("phone_number", recipientPhone)
      .single();

    if (recipientError || !recipient) {
      return {
        success: false,
        error: "recipient_not_found",
        message: `❌ User with phone ${recipientPhone} not found.`,
      };
    }

    if (recipient.id === ctx.profileId) {
      return {
        success: false,
        error: "self_transfer",
        message: "❌ You cannot transfer tokens to yourself.",
      };
    }

    // 3. Create transfer record (pending)
    const { data: transfer, error: transferError } = await ctx.supabase
      .from("wallet_transfers")
      .insert({
        sender_profile: ctx.profileId,
        recipient_profile: recipient.id,
        amount_tokens: amount,
        status: "pending",
        metadata: { channel: "whatsapp" }
      })
      .select()
      .single();

    if (transferError) throw transferError;

    // 4. Execute Debit (Sender)
    const { data: debitResult, error: debitError } = await ctx.supabase.rpc("wallet_delta_fn", {
      p_profile_id: ctx.profileId,
      p_amount_tokens: -amount,
      p_entry_type: "p2p_transfer",
      p_reference_table: "wallet_transfers",
      p_reference_id: transfer.id
    });

    if (debitError || !debitResult[0].success) {
      // Mark transfer as failed
      await ctx.supabase
        .from("wallet_transfers")
        .update({ status: "failed", metadata: { error: debitError?.message || debitResult?.[0]?.error } })
        .eq("id", transfer.id);

      return {
        success: false,
        error: "debit_failed",
        message: `❌ Transfer failed: ${debitResult?.[0]?.error || "Insufficient balance"}`,
      };
    }

    // 5. Execute Credit (Recipient)
    const { error: creditError } = await ctx.supabase.rpc("wallet_delta_fn", {
      p_profile_id: recipient.id,
      p_amount_tokens: amount,
      p_entry_type: "p2p_transfer",
      p_reference_table: "wallet_transfers",
      p_reference_id: transfer.id
    });

    if (creditError) {
      // CRITICAL: Credit failed but debit succeeded. Need to reverse debit.
      await ctx.supabase.rpc("wallet_delta_fn", {
        p_profile_id: ctx.profileId,
        p_amount_tokens: amount,
        p_entry_type: "reversal",
        p_reference_table: "wallet_transfers",
        p_reference_id: transfer.id
      });

      await ctx.supabase
        .from("wallet_transfers")
        .update({ status: "failed", metadata: { error: "Credit failed" } })
        .eq("id", transfer.id);

      return {
        success: false,
        error: "system_error",
        message: "❌ System error. Your tokens have been refunded.",
      };
    }

    // 6. Mark transfer complete
    await ctx.supabase
      .from("wallet_transfers")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", transfer.id);

    // 7. Notify
    await notifyTokenTransfer(
      ctx.from, // Sender phone
      recipientPhone,
      amount,
      transfer.id
    );

    return {
      success: true,
      transferId: transfer.id,
      message: `✅ Successfully sent ${amount} tokens to ${recipient.name || recipientPhone}`,
    };

  } catch (error) {
    await logStructuredEvent("TRANSFER_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: "unexpected_error",
      message: "❌ An unexpected error occurred.",
    };
  }
}
