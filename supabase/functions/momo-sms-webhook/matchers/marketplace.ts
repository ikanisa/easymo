/**
 * Marketplace Payment Matcher
 * Matches MoMo SMS to pending marketplace orders
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

interface MatchResult {
  id: string;
  table: string;
  confidence: number;
}

export async function matchMarketplacePayment(
  supabase: SupabaseClient,
  transaction: Record<string, unknown>,
  correlationId: string
): Promise<MatchResult | null> {
  const amount = transaction.amount as number;
  
  if (!amount || amount <= 0) {
    return null;
  }

  // Look for pending orders within last 48 hours
  const { data: pendingOrders, error } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, buyer_phone, status, created_at")
    .eq("payment_status", "pending")
    .eq("total_amount", amount)
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !pendingOrders || pendingOrders.length === 0) {
    await logStructuredEvent("MARKETPLACE_MATCHER_NO_MATCH", {
      correlationId,
      amount,
      reason: error ? "query_error" : "no_pending_orders",
    });
    return null;
  }

  const bestMatch = pendingOrders[0];

  // Update order payment status
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      momo_transaction_id: transaction.transaction_id,
      paid_at: new Date().toISOString(),
    })
    .eq("id", bestMatch.id);

  if (updateError) {
    await logStructuredEvent("MARKETPLACE_MATCHER_UPDATE_ERROR", {
      correlationId,
      orderId: bestMatch.id,
      error: updateError.message,
    });
    return null;
  }

  await logStructuredEvent("MARKETPLACE_PAYMENT_MATCHED", {
    correlationId,
    orderId: bestMatch.id,
    orderNumber: bestMatch.order_number,
    amount,
  });

  return {
    id: bestMatch.id,
    table: "orders",
    confidence: 0.90,
  };
}
