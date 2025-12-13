import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";

export const TRANSFER_LIMITS = {
  MIN_AMOUNT: 10, // tokens
  MAX_SINGLE_TRANSFER: 50000, // tokens
  DAILY_LIMIT: 100000, // tokens per day
  HOURLY_RATE_LIMIT: 10, // max transfers per hour
  LARGE_TRANSFER_THRESHOLD: 10000 // requires confirmation
};

export interface TransferValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  requiresConfirmation?: boolean;
}

export async function validateTransfer(
  ctx: RouterContext,
  amount: number,
  userId: string
): Promise<TransferValidationResult> {
  // Check minimum amount
  if (amount < TRANSFER_LIMITS.MIN_AMOUNT) {
    return {
      valid: false,
      error: `Minimum transfer: ${TRANSFER_LIMITS.MIN_AMOUNT} tokens`,
      errorCode: "amount_too_small"
    };
  }

  // Check maximum single transfer
  if (amount > TRANSFER_LIMITS.MAX_SINGLE_TRANSFER) {
    return {
      valid: false,
      error: `Maximum per transfer: ${TRANSFER_LIMITS.MAX_SINGLE_TRANSFER.toLocaleString()} tokens`,
      errorCode: "amount_too_large"
    };
  }

  // Check daily limit
  const dailyTotal = await getDailyTransferTotal(ctx, userId);
  if (dailyTotal + amount > TRANSFER_LIMITS.DAILY_LIMIT) {
    const remaining = TRANSFER_LIMITS.DAILY_LIMIT - dailyTotal;
    return {
      valid: false,
      error: `Daily limit reached. You can transfer ${remaining.toLocaleString()} more tokens today.`,
      errorCode: "daily_limit_exceeded"
    };
  }

  // Check hourly rate limit
  const hourlyCount = await getHourlyTransferCount(ctx, userId);
  if (hourlyCount >= TRANSFER_LIMITS.HOURLY_RATE_LIMIT) {
    return {
      valid: false,
      error: `Too many transfers. Please wait an hour before sending again.`,
      errorCode: "rate_limit_exceeded"
    };
  }

  // Check if requires confirmation (large transfer)
  const requiresConfirmation = amount >= TRANSFER_LIMITS.LARGE_TRANSFER_THRESHOLD;

  return {
    valid: true,
    requiresConfirmation
  };
}

async function getDailyTransferTotal(
  ctx: RouterContext,
  userId: string
): Promise<number> {
  // In simplified schema, we don't track transaction history
  // TODO: Implement Redis-based rate limiting if needed
  return 0;
}

async function getHourlyTransferCount(
  ctx: RouterContext,
  userId: string
): Promise<number> {
  // In simplified schema, we don't track transaction history
  // TODO: Implement Redis-based rate limiting if needed
  return 0;
}

export async function checkFraudRisk(
  ctx: RouterContext,
  userId: string,
  amount: number,
  recipientId: string
): Promise<{ risky: boolean; reason?: string }> {
  // Check if new user (created less than 24 hours ago)
  const { data: user } = await ctx.supabase
    .from("users")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (user) {
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (accountAge < oneDayMs && amount > 1000) {
      return {
        risky: true,
        reason: "New account attempting large transfer"
      };
    }
  }

  // In simplified schema, we don't track transaction history
  // Skip rapid transfer checks for now
  // TODO: Implement Redis-based fraud detection if needed

  return { risky: false };
}

export function formatTransferLimits(): string {
  return (
    `📋 *Transfer Limits:*\n\n` +
    `• Minimum: ${TRANSFER_LIMITS.MIN_AMOUNT} tokens\n` +
    `• Maximum per transfer: ${TRANSFER_LIMITS.MAX_SINGLE_TRANSFER.toLocaleString()} tokens\n` +
    `• Daily limit: ${TRANSFER_LIMITS.DAILY_LIMIT.toLocaleString()} tokens\n` +
    `• Rate limit: ${TRANSFER_LIMITS.HOURLY_RATE_LIMIT} transfers/hour\n` +
    `• Large transfers (>${TRANSFER_LIMITS.LARGE_TRANSFER_THRESHOLD.toLocaleString()}) require confirmation`
  );
}
