/**
 * Insurance Payment Matcher
 * Matches MoMo SMS to insurance premium payments
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

interface MatchResult {
  id: string;
  table: string;
  confidence: number;
}

export async function matchInsurancePayment(
  supabase: SupabaseClient,
  transaction: Record<string, unknown>,
  correlationId: string
): Promise<MatchResult | null> {
  const amount = transaction.amount as number;
  
  if (!amount || amount <= 0) {
    return null;
  }

  // Look for pending insurance payments
  const { data: pendingPayments, error } = await supabase
    .from("insurance_payments")
    .select("id, policy_id, premium_amount, customer_phone, status, created_at")
    .eq("status", "pending")
    .eq("premium_amount", amount)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !pendingPayments || pendingPayments.length === 0) {
    await logStructuredEvent("INSURANCE_MATCHER_NO_MATCH", {
      correlationId,
      amount,
      reason: error ? "query_error" : "no_pending_payments",
    });
    return null;
  }

  const bestMatch = pendingPayments[0];

  // Update insurance payment status
  const { error: updateError } = await supabase
    .from("insurance_payments")
    .update({
      status: "paid",
      momo_transaction_id: transaction.transaction_id,
      paid_at: new Date().toISOString(),
    })
    .eq("id", bestMatch.id);

  if (updateError) {
    await logStructuredEvent("INSURANCE_MATCHER_UPDATE_ERROR", {
      correlationId,
      paymentId: bestMatch.id,
      error: updateError.message,
    });
    return null;
  }

  // Update policy status if needed
  if (bestMatch.policy_id) {
    await supabase
      .from("insurance_policies")
      .update({ payment_status: "active" })
      .eq("id", bestMatch.policy_id);
  }

  await logStructuredEvent("INSURANCE_PAYMENT_MATCHED", {
    correlationId,
    paymentId: bestMatch.id,
    policyId: bestMatch.policy_id,
    amount,
  });

  return {
    id: bestMatch.id,
    table: "insurance_payments",
    confidence: 0.90,
  };
}
