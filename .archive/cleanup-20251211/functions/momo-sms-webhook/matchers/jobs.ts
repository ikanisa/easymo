/**
 * Jobs Payment Matcher
 * Matches MoMo SMS to job-related payments
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

interface MatchResult {
  id: string;
  table: string;
  confidence: number;
}

export async function matchJobPayment(
  supabase: SupabaseClient,
  transaction: Record<string, unknown>,
  correlationId: string
): Promise<MatchResult | null> {
  const amount = transaction.amount as number;
  
  if (!amount || amount <= 0) {
    return null;
  }

  // Look for pending job payments (gig completions, contract payments)
  const { data: pendingPayments, error } = await supabase
    .from("job_payments")
    .select("id, job_id, contract_id, amount, payer_phone, status, created_at")
    .eq("status", "pending")
    .eq("amount", amount)
    .gte("created_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !pendingPayments || pendingPayments.length === 0) {
    await logStructuredEvent("JOBS_MATCHER_NO_MATCH", {
      correlationId,
      amount,
      reason: error ? "query_error" : "no_pending_payments",
    });
    return null;
  }

  const bestMatch = pendingPayments[0];

  // Update job payment status
  const { error: updateError } = await supabase
    .from("job_payments")
    .update({
      status: "completed",
      momo_transaction_id: transaction.transaction_id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", bestMatch.id);

  if (updateError) {
    await logStructuredEvent("JOBS_MATCHER_UPDATE_ERROR", {
      correlationId,
      paymentId: bestMatch.id,
      error: updateError.message,
    });
    return null;
  }

  await logStructuredEvent("JOBS_PAYMENT_MATCHED", {
    correlationId,
    paymentId: bestMatch.id,
    jobId: bestMatch.job_id,
    contractId: bestMatch.contract_id,
    amount,
  });

  return {
    id: bestMatch.id,
    table: "job_payments",
    confidence: 0.85,
  };
}
