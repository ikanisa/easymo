import type { RouterContext } from "../types.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { notifyTokenTransfer } from "./notifications.ts";

export interface TransferResult {
  success: boolean;
  transferId?: string;
  error?: string;
  message: string;
}

/**
 * Transfer tokens between users using the atomic wallet_transfer_tokens RPC.
 * This RPC handles:
 * - Balance validation
 * - Atomic transaction (single database transaction)
 * - Idempotency protection
 * - Audit trail creation
 */
export async function transferTokens(
  ctx: RouterContext,
  recipientPhone: string,
  amount: number,
  _pin?: string
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

  // Generate idempotency key for this transfer
  const idempotencyKey = `transfer:${ctx.profileId}:${recipientPhone}:${amount}:${Date.now()}`;

  try {
    // Find recipient using whatsapp_e164
    const { data: recipient, error: recipientError } = await ctx.supabase
      .from("profiles")
      .select("id, name, whatsapp_e164")
      .eq("whatsapp_e164", recipientPhone)
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

    // Execute atomic transfer using wallet_transfer_tokens RPC
    const { data: result, error: transferError } = await ctx.supabase.rpc(
      "wallet_transfer_tokens",
      {
        p_sender: ctx.profileId,
        p_recipient_whatsapp: recipientPhone,
        p_amount: amount,
        p_idempotency_key: idempotencyKey,
      },
    );

    if (transferError) {
      await logStructuredEvent("TRANSFER_RPC_ERROR", {
        userId: ctx.profileId,
        recipientPhone,
        amount,
        error: transferError.message,
      });
      throw transferError;
    }

    const row = Array.isArray(result) ? result[0] : result;
    
    if (row?.success) {
      // Notify both parties
      await notifyTokenTransfer(
        ctx.from, // Sender phone
        recipientPhone,
        amount,
        row.transfer_id || "unknown"
      );

      return {
        success: true,
        transferId: row.transfer_id,
        message: `✅ Successfully sent ${amount} tokens to ${recipient.name || recipientPhone}`,
      };
    } else {
      const reason = row?.reason || "Transfer failed";
      return {
        success: false,
        error: "transfer_failed",
        message: `❌ ${reason}`,
      };
    }

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
