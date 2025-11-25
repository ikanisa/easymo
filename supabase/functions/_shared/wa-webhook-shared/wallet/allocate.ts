import type { RouterContext } from "../types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { logStructuredEvent } from "../observe/log.ts";

export interface TokenAllocationResult {
  success: boolean;
  allocationId?: string;
  error?: string;
  message: string;
}

/**
 * Admin allocates tokens to a user
 */
export async function allocateTokens(
  ctx: RouterContext,
  recipientPhone: string,
  amount: number,
  reason: string
): Promise<TokenAllocationResult> {
  if (!ctx.profileId) {
    return {
      success: false,
      error: "unauthorized",
      message: "❌ Authentication required",
    };
  }

  // Validate amount
  if (amount <= 0 || amount > 100000) {
    return {
      success: false,
      error: "invalid_amount",
      message: "❌ Amount must be between 1 and 100,000 tokens",
    };
  }

  try {
    // Find recipient
    const { data: recipient, error: recipientError } = await ctx.supabase
      .from("profiles")
      .select("id, name, phone_number")
      .eq("phone_number", recipientPhone)
      .single();

    if (recipientError || !recipient) {
      return {
        success: false,
        error: "recipient_not_found",
        message: `❌ User with phone ${recipientPhone} not found.\n\nThey must be registered on easyMO.`,
      };
    }

    // Create allocation record
    const { data: allocation, error: allocError } = await ctx.supabase
      .from("token_allocations")
      .insert({
        admin_id: ctx.profileId,
        recipient_id: recipient.id,
        amount,
        reason: reason || "Admin allocation",
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (allocError) {
      await logStructuredEvent("TOKEN_ALLOCATION_FAILED", {
        adminId: ctx.profileId,
        recipientPhone,
        amount,
        error: allocError.message,
      });

      return {
        success: false,
        error: "allocation_failed",
        message: `❌ Failed to create allocation: ${allocError.message}`,
      };
    }

    // Execute allocation using wallet RPC
    const { error: walletError } = await ctx.supabase.rpc("wallet_delta_fn", {
      p_profile_id: recipient.id,
      p_amount_tokens: amount,
      p_entry_type: "admin_allocation",
      p_reference_table: "token_allocations",
      p_reference_id: allocation.id,
    });

    if (walletError) {
      // Rollback allocation record
      await ctx.supabase
        .from("token_allocations")
        .update({ status: "failed" })
        .eq("id", allocation.id);

      await logStructuredEvent("TOKEN_ALLOCATION_WALLET_FAILED", {
        allocationId: allocation.id,
        error: walletError.message,
      });

      return {
        success: false,
        error: "wallet_update_failed",
        message: `❌ Wallet update failed: ${walletError.message}`,
      };
    }

    await logStructuredEvent("TOKEN_ALLOCATION_SUCCESS", {
      adminId: ctx.profileId,
      recipientId: recipient.id,
      amount,
      reason,
      allocationId: allocation.id,
    });

    return {
      success: true,
      allocationId: allocation.id,
      message: `✅ Successfully allocated ${amount} tokens to ${recipient.name || recipientPhone}\n\n` +
               `Allocation ID: ${allocation.id}\n` +
               `Reason: ${reason}\n\n` +
               `The tokens have been added to their wallet.`,
    };
  } catch (error) {
    await logStructuredEvent("TOKEN_ALLOCATION_ERROR", {
      adminId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: "unexpected_error",
      message: `❌ Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Allocate insurance bonus tokens
 */
export async function allocateInsuranceBonus(
  supabase: SupabaseClient,
  userId: string,
  policyId: string,
  amount: number = 2000
): Promise<TokenAllocationResult> {
  try {
    // Check if already awarded
    const { data: existing } = await supabase
      .from("token_allocations")
      .select("id")
      .eq("recipient_id", userId)
      .eq("reference_id", policyId)
      .eq("reason", "insurance_purchase_bonus")
      .single();

    if (existing) {
      return {
        success: false,
        error: "already_awarded",
        message: "Tokens already awarded for this policy",
      };
    }

    // Create allocation
    const { data: allocation, error: allocError } = await supabase
      .from("token_allocations")
      .insert({
        recipient_id: userId,
        amount,
        reason: "insurance_purchase_bonus",
        reference_id: policyId,
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (allocError) throw allocError;

    // Award tokens
    const { error: walletError } = await supabase.rpc("wallet_delta_fn", {
      p_profile_id: userId,
      p_amount_tokens: amount,
      p_entry_type: "insurance_bonus",
      p_reference_table: "token_allocations",
      p_reference_id: allocation.id,
    });

    if (walletError) {
      await supabase
        .from("token_allocations")
        .update({ status: "failed" })
        .eq("id", allocation.id);
      throw walletError;
    }

    await logStructuredEvent("INSURANCE_BONUS_AWARDED", {
      userId,
      policyId,
      amount,
      allocationId: allocation.id,
    });

    return {
      success: true,
      allocationId: allocation.id,
      message: `🎉 You've earned ${amount} tokens for your insurance purchase!`,
    };
  } catch (error) {
    await logStructuredEvent("INSURANCE_BONUS_ERROR", {
      userId,
      policyId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: "bonus_failed",
      message: "Failed to award insurance bonus",
    };
  }
}

/**
 * Allocate referral bonus tokens
 */
export async function allocateReferralBonus(
  supabase: SupabaseClient,
  referrerId: string,
  referredUserId: string,
  amount: number = 10
): Promise<TokenAllocationResult> {
  try {
    // Check if already awarded
    const { data: existing } = await supabase
      .from("token_allocations")
      .select("id")
      .eq("recipient_id", referrerId)
      .eq("reference_id", referredUserId)
      .eq("reason", "referral_bonus")
      .single();

    if (existing) {
      return {
        success: false,
        error: "already_awarded",
        message: "Referral bonus already awarded",
      };
    }

    // Create allocation
    const { data: allocation, error: allocError } = await supabase
      .from("token_allocations")
      .insert({
        recipient_id: referrerId,
        amount,
        reason: "referral_bonus",
        reference_id: referredUserId,
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (allocError) throw allocError;

    // Award tokens
    const { error: walletError } = await supabase.rpc("wallet_delta_fn", {
      p_profile_id: referrerId,
      p_amount_tokens: amount,
      p_entry_type: "referral_bonus",
      p_reference_table: "token_allocations",
      p_reference_id: allocation.id,
    });

    if (walletError) {
      await supabase
        .from("token_allocations")
        .update({ status: "failed" })
        .eq("id", allocation.id);
      throw walletError;
    }

    await logStructuredEvent("REFERRAL_BONUS_AWARDED", {
      referrerId,
      referredUserId,
      amount,
      allocationId: allocation.id,
    });

    return {
      success: true,
      allocationId: allocation.id,
      message: `🎉 You've earned ${amount} tokens for referring a friend!`,
    };
  } catch (error) {
    await logStructuredEvent("REFERRAL_BONUS_ERROR", {
      referrerId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: "bonus_failed",
      message: "Failed to award referral bonus",
    };
  }
}
