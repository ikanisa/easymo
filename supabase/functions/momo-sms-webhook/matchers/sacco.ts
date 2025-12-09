/**
 * SACCO Payment Matcher
 * Matches MoMo SMS to SACCO members and processes payments
 * 
 * Flow:
 * 1. Get SACCO ID from webhook endpoint
 * 2. Store SMS in app.sms_inbox
 * 3. Match sender to member by phone hash or name
 * 4. Create payment record in app.payments
 * 5. Update member balance in app.accounts
 * 6. Create ledger entry for audit trail
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

interface MatchResult {
  id: string;
  table: string;
  confidence: number;
}

interface Transaction {
  id: string;
  phone_number: string;
  sender: string;
  raw_message: string;
  amount?: number;
  sender_name?: string;
  transaction_id?: string;
  provider?: string;
}

export async function matchSaccoPayment(
  supabase: SupabaseClient,
  transaction: Transaction,
  correlationId: string
): Promise<MatchResult | null> {
  const amount = transaction.amount;
  const senderPhone = transaction.sender;
  const senderName = transaction.sender_name;
  
  if (!amount || amount <= 0) {
    await logStructuredEvent("SACCO_MATCHER_INVALID_AMOUNT", {
      correlationId,
      amount,
    });
    return null;
  }

  // 1. Get SACCO ID from webhook endpoint
  const { data: endpoint, error: endpointError } = await supabase
    .from("momo_webhook_endpoints")
    .select("sacco_id")
    .eq("momo_phone_number", transaction.phone_number)
    .eq("service_type", "sacco")
    .eq("is_active", true)
    .single();

  if (endpointError || !endpoint || !endpoint.sacco_id) {
    await logStructuredEvent("SACCO_MATCHER_NO_ENDPOINT", {
      correlationId,
      phone: transaction.phone_number,
      error: endpointError?.message,
    });
    return null;
  }

  const saccoId = endpoint.sacco_id;

  // 2. Store SMS in app.sms_inbox
  const { data: smsInbox, error: smsError } = await supabase
    .from("app.sms_inbox")
    .insert({
      sacco_id: saccoId,
      raw_message: transaction.raw_message,
      sender_phone: senderPhone,
      sender_name: senderName,
      amount: amount,
      transaction_id: transaction.transaction_id,
      provider: transaction.provider,
      status: "pending",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (smsError || !smsInbox) {
    await logStructuredEvent("SACCO_MATCHER_SMS_STORE_ERROR", {
      correlationId,
      saccoId,
      error: smsError?.message,
    });
    return null;
  }

  // 3. Match sender to member by phone hash
  let matchResult = null;
  let memberId = null;
  let matchConfidence = 0;
  let matchMethod = null;

  if (senderPhone) {
    const { data: phoneMatch, error: phoneMatchError } = await supabase
      .rpc("app.match_sms_to_member", {
        p_sacco_id: saccoId,
        p_sender_phone: senderPhone,
      });

    if (!phoneMatchError && phoneMatch && phoneMatch.length > 0) {
      const match = phoneMatch[0];
      memberId = match.member_id;
      matchConfidence = match.confidence;
      matchMethod = match.match_method;
    }
  }

  // 4. If no phone match, try name matching
  if (!memberId && senderName) {
    const { data: nameMatch, error: nameMatchError } = await supabase
      .rpc("app.match_sms_to_member_by_name", {
        p_sacco_id: saccoId,
        p_sender_name: senderName,
      });

    if (!nameMatchError && nameMatch && nameMatch.length > 0) {
      const match = nameMatch[0];
      memberId = match.member_id;
      matchConfidence = match.confidence;
      matchMethod = match.match_method;
    }
  }

  // 5. Update SMS inbox with match result
  if (memberId) {
    await supabase
      .from("app.sms_inbox")
      .update({
        matched_member_id: memberId,
        match_confidence: matchConfidence,
        match_method: matchMethod,
        status: "matched",
        processed_at: new Date().toISOString(),
      })
      .eq("id", smsInbox.id);

    // 6. Process payment (creates payment, updates balance, creates ledger entry)
    try {
      const { data: paymentId, error: paymentError } = await supabase
        .rpc("app.process_sacco_payment", {
          p_sacco_id: saccoId,
          p_member_id: memberId,
          p_amount: amount,
          p_reference: `MoMo payment from ${senderName || senderPhone}`,
          p_transaction_id: transaction.transaction_id,
          p_provider: transaction.provider,
          p_sms_inbox_id: smsInbox.id,
          p_account_type: "savings",
        });

      if (paymentError) {
        await logStructuredEvent("SACCO_MATCHER_PAYMENT_ERROR", {
          correlationId,
          saccoId,
          memberId,
          error: paymentError.message,
        });
        return null;
      }

      await logStructuredEvent("SACCO_PAYMENT_MATCHED", {
        correlationId,
        saccoId,
        memberId,
        amount,
        paymentId,
        matchMethod,
        matchConfidence,
      });

      return {
        id: paymentId as string,
        table: "app.payments",
        confidence: matchConfidence,
      };
    } catch (error) {
      await logStructuredEvent("SACCO_MATCHER_EXCEPTION", {
        correlationId,
        saccoId,
        memberId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  } else {
    // No match found - mark as unmatched for manual review
    await supabase
      .from("app.sms_inbox")
      .update({
        status: "unmatched",
        processed_at: new Date().toISOString(),
      })
      .eq("id", smsInbox.id);

    await logStructuredEvent("SACCO_MATCHER_NO_MATCH", {
      correlationId,
      saccoId,
      senderPhone,
      senderName,
      amount,
    });

    return null;
  }
}
