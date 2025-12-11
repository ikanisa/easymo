/**
 * Rides Payment Matcher
 * Matches MoMo SMS to pending ride payments
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

interface MatchResult {
  id: string;
  table: string;
  confidence: number;
}

export async function matchRidePayment(
  supabase: SupabaseClient,
  transaction: Record<string, unknown>,
  correlationId: string
): Promise<MatchResult | null> {
  const amount = transaction.amount as number;
  
  if (!amount || amount <= 0) {
    return null;
  }

  // Look for pending ride payments within last 24 hours
  const { data: pendingPayments, error } = await supabase
    .from("ride_payments")
    .select("id, trip_id, amount, rider_phone, driver_phone, created_at")
    .eq("status", "pending")
    .eq("amount", amount)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !pendingPayments || pendingPayments.length === 0) {
    await logStructuredEvent("RIDES_MATCHER_NO_MATCH", {
      correlationId,
      amount,
      reason: error ? "query_error" : "no_pending_payments",
    });
    return null;
  }

  // Find best match (exact amount match)
  const bestMatch = pendingPayments[0];

  // Update the ride payment status
  const { error: updateError } = await supabase
    .from("ride_payments")
    .update({
      status: "completed",
      momo_transaction_id: transaction.transaction_id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", bestMatch.id);

  if (updateError) {
    await logStructuredEvent("RIDES_MATCHER_UPDATE_ERROR", {
      correlationId,
      paymentId: bestMatch.id,
      error: updateError.message,
    });
    return null;
  }

  // Also update the trip status if needed
  if (bestMatch.trip_id) {
    await supabase
      .from("trips")
      .update({ payment_status: "paid" })
      .eq("id", bestMatch.trip_id);
  }

  await logStructuredEvent("RIDES_PAYMENT_MATCHED", {
    correlationId,
    paymentId: bestMatch.id,
    tripId: bestMatch.trip_id,
    amount,
  });

  return {
    id: bestMatch.id,
    table: "ride_payments",
    confidence: 0.95,
  };
}
