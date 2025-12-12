import type { SupabaseClient } from "@supabase/supabase-js";

export interface TransferLimits {
  dailyLimit: number;
  hourlyRateLimit: number;
  largeTransferThreshold: number;
}

export const DEFAULT_LIMITS: TransferLimits = {
  dailyLimit: 100000, // 100k tokens per day
  hourlyRateLimit: 10, // 10 transfers per hour
  largeTransferThreshold: 10000 // Require confirmation for >10k tokens
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
  requiresConfirmation?: boolean;
}

export async function validateTransferLimits(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<ValidationResult> {
  try {
    // Check daily limit
    const { data: dailyTotal, error: dailyError } = await supabase.rpc(
      'get_daily_transfer_total',
      { p_user_id: userId }
    );

    if (dailyError) {
      console.error("Daily limit check error:", dailyError);
      return { valid: false, error: "Error checking transfer limits" };
    }

    const currentDaily = dailyTotal || 0;
    if (currentDaily + amount > DEFAULT_LIMITS.dailyLimit) {
      return {
        valid: false,
        error: `Daily transfer limit exceeded. Limit: ${DEFAULT_LIMITS.dailyLimit.toLocaleString()} tokens, Used: ${currentDaily.toLocaleString()}, Remaining: ${(DEFAULT_LIMITS.dailyLimit - currentDaily).toLocaleString()}`
      };
    }

    // Check hourly rate limit
    const { data: hourlyCount, error: hourlyError } = await supabase.rpc(
      'get_hourly_transfer_count',
      { p_user_id: userId }
    );

    if (hourlyError) {
      console.error("Hourly rate check error:", hourlyError);
      return { valid: false, error: "Error checking transfer rate" };
    }

    const currentHourly = hourlyCount || 0;
    if (currentHourly >= DEFAULT_LIMITS.hourlyRateLimit) {
      return {
        valid: false,
        error: `Too many transfers. You've made ${currentHourly} transfers in the last hour. Please wait before trying again.`
      };
    }

    // Check if large transfer requires confirmation
    if (amount > DEFAULT_LIMITS.largeTransferThreshold) {
      return {
        valid: true,
        requiresConfirmation: true
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Transfer validation error:", error);
    return {
      valid: false,
      error: "Unexpected error validating transfer"
    };
  }
}

export async function checkSufficientBalance(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<ValidationResult> {
  try {
    const { data: wallet, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (error || !wallet) {
      return { valid: false, error: "Error checking balance" };
    }

    if (wallet.balance < amount) {
      return {
        valid: false,
        error: `Insufficient balance. You have ${wallet.balance.toLocaleString()} tokens, need ${amount.toLocaleString()}`
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Balance check error:", error);
    return { valid: false, error: "Error checking balance" };
  }
}
