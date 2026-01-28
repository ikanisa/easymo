import { logStructuredEvent } from "../../observability/index.ts";
import type { RouterContext } from "../types.ts";
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

  // Generate idempotency key for this transfer using crypto.randomUUID()
  const idempotencyKey = `transfer:${ctx.profileId}:${recipientPhone}:${amount}:${crypto.randomUUID()}`;

  try {
    // Normalize phone number to E.164 format
    const normalizedPhone = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
    
    // Find recipient using wa_id and phone_number columns
    let recipient: { user_id: string; name?: string; wa_id?: string; phone_number?: string } | null = null;
    
    // Try wa_id first (digits only)
    const waId = normalizedPhone.replace(/^\+/, '');
    const { data: recipient1 } = await ctx.supabase
      .from("profiles")
      .select("user_id, full_name, wa_id, phone_number")
      .eq("wa_id", waId)
      .maybeSingle();
    
    if (recipient1?.user_id) {
      recipient = { 
        user_id: recipient1.user_id, 
        name: recipient1.full_name || undefined,
        wa_id: recipient1.wa_id || undefined,
        phone_number: recipient1.phone_number || undefined
      };
    } else {
      // Fallback: try phone_number (E.164 format)
      const { data: recipient2 } = await ctx.supabase
        .from("profiles")
        .select("user_id, full_name, wa_id, phone_number")
        .or(`phone_number.eq.${normalizedPhone},phone_number.eq.${waId}`)
        .maybeSingle();
      
      if (recipient2?.user_id) {
        recipient = { 
          user_id: recipient2.user_id, 
          name: recipient2.full_name || undefined,
          wa_id: recipient2.wa_id || undefined,
          phone_number: recipient2.phone_number || undefined
        };
      }
    }

    // If recipient still not found, auto-create profile for new user
    if (!recipient?.user_id) {
      await logStructuredEvent("TRANSFER_AUTO_CREATE_RECIPIENT", {
        userId: ctx.profileId,
        recipientPhone: normalizedPhone,
      });
      
      // Import ensureProfile to auto-create
      const { ensureProfile } = await import("../utils/profile.ts");
      const newProfile = await ensureProfile(ctx.supabase, normalizedPhone);
      
      if (!newProfile?.user_id) {
        return {
          success: false,
          error: "recipient_not_found",
          message: `❌ Could not find or create user with phone ${normalizedPhone}.`,
        };
      }
      
      recipient = { user_id: newProfile.user_id, name: undefined, phone_number: normalizedPhone, wa_id: waId };
      
      await logStructuredEvent("TRANSFER_RECIPIENT_CREATED", {
        userId: ctx.profileId,
        recipientId: recipient.user_id,
        recipientPhone: normalizedPhone,
      });
    }
    
    // Get actual WhatsApp number for notifications (use phone_number if available, else normalized)
    const recipientWhatsApp = recipient.phone_number || recipient.wa_id || normalizedPhone;

    if (recipient.user_id === ctx.profileId) {
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

    const row = Array.isArray(result) ? result[0] ?? null : result;
    
    if (row?.success) {
      // Notify both parties using their WhatsApp numbers
      await notifyTokenTransfer(
        ctx.from, // Sender phone
        recipientWhatsApp, // Recipient's actual WhatsApp number
        amount,
        row.transfer_id || "unknown"
      );

      return {
        success: true,
        transferId: row.transfer_id,
        message: `✅ Successfully sent ${amount} tokens to ${recipient.name || recipientWhatsApp}`,
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
