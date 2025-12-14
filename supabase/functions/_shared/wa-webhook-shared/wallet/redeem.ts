import type { RouterContext } from "../types.ts";
import { logStructuredEvent } from "../../observability/index.ts";
import { notifyTokenRedemption } from "./notifications.ts";

export interface RedemptionResult {
  success: boolean;
  redemptionId?: string;
  error?: string;
  message: string;
}

/**
 * Redeem tokens for a reward
 */
export async function redeemTokens(
  ctx: RouterContext,
  rewardId: string,
  quantity: number = 1
): Promise<RedemptionResult> {
  if (!ctx.profileId) {
    return {
      success: false,
      error: "unauthorized",
      message: "❌ Authentication required",
    };
  }

  try {
    // 1. Get reward details
    const { data: reward, error: rewardError } = await ctx.supabase
      .from("token_rewards")
      .select("*")
      .eq("id", rewardId)
      .single();

    if (rewardError || !reward) {
      return {
        success: false,
        error: "reward_not_found",
        message: "❌ Reward not found or unavailable.",
      };
    }

    if (reward.status !== "active") {
      return {
        success: false,
        error: "reward_inactive",
        message: "❌ This reward is no longer available.",
      };
    }

    const totalCost = reward.cost_tokens * quantity;

    // 2. Create redemption record (pending)
    const { data: redemption, error: redemptionError } = await ctx.supabase
      .from("token_redemptions")
      .insert({
        profile_id: ctx.profileId,
        reward_id: rewardId,
        tokens_spent: totalCost,
        status: "pending",
      })
      .select()
      .single();

    if (redemptionError) throw redemptionError;

    // 3. Deduct tokens
    const { data: debitResult, error: debitError } = await ctx.supabase.rpc("wallet_delta_fn", {
      p_profile_id: ctx.profileId,
      p_amount_tokens: -totalCost,
      p_entry_type: "redemption",
      p_reference_table: "token_redemptions",
      p_reference_id: redemption.id
    });

    if (debitError || !debitResult[0].success) {
      // Mark as failed
      await ctx.supabase
        .from("token_redemptions")
        .update({ status: "failed" })
        .eq("id", redemption.id);

      return {
        success: false,
        error: "insufficient_balance",
        message: `❌ Insufficient tokens. You need ${totalCost} tokens.`,
      };
    }

    // 4. Mark as approved (auto-approve for now, or pending if manual fulfillment)
    // For digital rewards, we might auto-approve. For physical, keep pending.
    // Assuming auto-approve for this implementation
    await ctx.supabase
      .from("token_redemptions")
      .update({ status: "approved", processed_at: new Date().toISOString() })
      .eq("id", redemption.id);

    // 5. Notify
    await notifyTokenRedemption(
      ctx.from,
      reward.name,
      totalCost,
      redemption.id
    );

    return {
      success: true,
      redemptionId: redemption.id,
      message: `✅ Successfully redeemed ${quantity}x ${reward.name} for ${totalCost} tokens!`,
    };

  } catch (error) {
    await logStructuredEvent("REDEMPTION_ERROR", {
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
