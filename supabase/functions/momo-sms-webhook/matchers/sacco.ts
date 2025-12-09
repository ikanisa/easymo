/**
 * SACCO Payment Matcher
 *
 * Matches incoming MoMo SMS payments to SACCO members and processes payments.
 *
 * Flow:
 * 1. Check if receiving phone belongs to a SACCO
 * 2. Store SMS in inbox (linked to momo_transactions)
 * 3. Try to match sender to member (by phone hash, then by name)
 * 4. If matched: create payment, update balance, create ledger entry
 * 5. If not matched: mark SMS as unmatched for manual review
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MomoTransaction {
  id: string;
  phone_number: string;
  sender_name: string | null;
  sender_phone: string | null;
  amount: number | null;
  transaction_id: string | null;
  provider: string;
  raw_message: string;
  received_at: string;
}

export interface SaccoMatchResult {
  matched: boolean;
  sacco_id: string | null;
  sacco_name: string | null;
  member_id: string | null;
  member_name: string | null;
  payment_id: string | null;
  sms_id: string | null;
  confidence: number;
  error: string | null;
}

interface MemberMatch {
  member_id: string;
  member_name: string;
  member_code: string | null;
  ikimina_id: string | null;
  ikimina_name: string | null;
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Matcher Function
// ═══════════════════════════════════════════════════════════════════════════

export async function matchSaccoPayment(
  supabase: SupabaseClient,
  transaction: MomoTransaction,
  correlationId: string
): Promise<SaccoMatchResult> {
  const result: SaccoMatchResult = {
    matched: false,
    sacco_id: null,
    sacco_name: null,
    member_id: null,
    member_name: null,
    payment_id: null,
    sms_id: null,
    confidence: 0,
    error: null,
  };

  try {
    console.log(`[${correlationId}] Starting SACCO payment match for phone: ${transaction.phone_number}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Check if phone belongs to a SACCO
    // ─────────────────────────────────────────────────────────────────────────
    const { data: saccoData, error: saccoError } = await supabase
      .rpc("get_sacco_for_phone", { p_phone_number: transaction.phone_number });

    if (saccoError) {
      console.error(`[${correlationId}] Error checking SACCO:`, saccoError);
      result.error = `SACCO lookup failed: ${saccoError.message}`;
      return result;
    }

    if (!saccoData || saccoData.length === 0) {
      console.log(`[${correlationId}] No SACCO registered for phone: ${transaction.phone_number}`);
      result.error = "No SACCO registered for this phone";
      return result;
    }

    const sacco = saccoData[0];
    result.sacco_id = sacco.sacco_id;
    result.sacco_name = sacco.sacco_name;

    console.log(`[${correlationId}] Found SACCO: ${sacco.sacco_name} (${sacco.sacco_id})`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Store SMS in inbox (linked to momo_transactions)
    // ─────────────────────────────────────────────────────────────────────────
    const parsedData = {
      amount: transaction.amount,
      sender_name: transaction.sender_name,
      sender_phone: transaction.sender_phone,
      transaction_id: transaction.transaction_id,
      provider: transaction.provider,
      correlation_id: correlationId,
    };

    const { data: smsId, error: smsError } = await supabase
      .rpc("store_sms_inbox", {
        p_sacco_id: sacco.sacco_id,
        p_sender: transaction.sender_name || transaction.sender_phone || "Unknown",
        p_message: transaction.raw_message,
        p_parsed_data: parsedData,
        p_received_at: transaction.received_at,
        p_momo_transaction_id: transaction.id,  // Link to momo_transactions
      });

    if (smsError) {
      console.error(`[${correlationId}] Error storing SMS:`, smsError);
      result.error = `SMS storage failed: ${smsError.message}`;
      return result;
    }

    result.sms_id = smsId;
    console.log(`[${correlationId}] Stored SMS: ${smsId}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Validate payment amount
    // ─────────────────────────────────────────────────────────────────────────
    if (!transaction.amount || transaction.amount <= 0) {
      console.log(`[${correlationId}] Invalid or missing amount`);
      await updateSmsStatus(supabase, smsId, "unmatched", null, null, 0);
      result.error = "Invalid payment amount";
      return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Try to match member
    // ─────────────────────────────────────────────────────────────────────────
    let memberMatch: MemberMatch | null = null;

    // Try matching by phone first (if sender phone is available)
    if (transaction.sender_phone) {
      const phoneMatch = await matchByPhone(supabase, sacco.sacco_id, transaction.sender_phone, correlationId);
      if (phoneMatch) {
        memberMatch = phoneMatch;
        console.log(`[${correlationId}] Matched by phone: ${phoneMatch.member_name} (confidence: ${phoneMatch.confidence})`);
      }
    }

    // If no phone match, try matching by name
    if (!memberMatch && transaction.sender_name) {
      const nameMatch = await matchByName(supabase, sacco.sacco_id, transaction.sender_name, correlationId);
      if (nameMatch) {
        memberMatch = nameMatch;
        console.log(`[${correlationId}] Matched by name: ${nameMatch.member_name} (confidence: ${nameMatch.confidence})`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: Process payment or mark as unmatched
    // ─────────────────────────────────────────────────────────────────────────
    if (memberMatch && memberMatch.confidence >= 0.7) {
      // Process the payment
      const paymentResult = await processPayment(
        supabase,
        sacco.sacco_id,
        memberMatch.member_id,
        transaction.amount,
        transaction.transaction_id || `SMS-${smsId}`,
        transaction.provider,
        smsId,
        correlationId
      );

      if (paymentResult.success) {
        result.matched = true;
        result.member_id = memberMatch.member_id;
        result.member_name = memberMatch.member_name;
        result.payment_id = paymentResult.payment_id;
        result.confidence = memberMatch.confidence;

        // Update SMS with match info
        await updateSmsStatus(
          supabase,
          smsId,
          "matched",
          memberMatch.member_id,
          paymentResult.payment_id,
          memberMatch.confidence
        );

        console.log(`[${correlationId}] Payment processed successfully: ${paymentResult.payment_id}`);
      } else {
        result.error = paymentResult.error;
        await updateSmsStatus(supabase, smsId, "error", null, null, 0);
      }
    } else {
      // No match found - mark for manual review
      console.log(`[${correlationId}] No member match found, marking as unmatched`);
      await updateSmsStatus(supabase, smsId, "unmatched", null, null, memberMatch?.confidence || 0);
      result.error = "No matching member found";
    }

    return result;
  } catch (error) {
    console.error(`[${correlationId}] Unexpected error in SACCO matcher:`, error);
    result.error = error instanceof Error ? error.message : "Unknown error";
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

async function matchByPhone(
  supabase: SupabaseClient,
  saccoId: string,
  phone: string,
  correlationId: string
): Promise<MemberMatch | null> {
  try {
    const { data, error } = await supabase
      .rpc("match_member_by_phone", {
        p_sacco_id: saccoId,
        p_phone: phone,
      });

    if (error) {
      console.error(`[${correlationId}] Phone match error:`, error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0];
    }

    return null;
  } catch (error) {
    console.error(`[${correlationId}] Phone match exception:`, error);
    return null;
  }
}

async function matchByName(
  supabase: SupabaseClient,
  saccoId: string,
  name: string,
  correlationId: string
): Promise<MemberMatch | null> {
  try {
    const { data, error } = await supabase
      .rpc("match_member_by_name", {
        p_sacco_id: saccoId,
        p_name: name,
      });

    if (error) {
      console.error(`[${correlationId}] Name match error:`, error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0];
    }

    return null;
  } catch (error) {
    console.error(`[${correlationId}] Name match exception:`, error);
    return null;
  }
}

async function processPayment(
  supabase: SupabaseClient,
  saccoId: string,
  memberId: string,
  amount: number,
  reference: string,
  provider: string,
  smsId: string,
  correlationId: string
): Promise<{ success: boolean; payment_id: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .rpc("process_sacco_payment", {
        p_sacco_id: saccoId,
        p_member_id: memberId,
        p_amount: amount,
        p_reference: reference,
        p_payment_method: provider,
        p_sms_id: smsId,
        p_metadata: { correlation_id: correlationId },
      });

    if (error) {
      console.error(`[${correlationId}] Payment processing error:`, error);
      return { success: false, payment_id: null, error: error.message };
    }

    if (data && data.length > 0) {
      return { success: true, payment_id: data[0].payment_id, error: null };
    }

    return { success: false, payment_id: null, error: "No payment created" };
  } catch (error) {
    console.error(`[${correlationId}] Payment processing exception:`, error);
    return {
      success: false,
      payment_id: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function updateSmsStatus(
  supabase: SupabaseClient,
  smsId: string,
  status: string,
  memberId: string | null,
  paymentId: string | null,
  confidence: number
): Promise<void> {
  try {
    await supabase.rpc("update_sms_match", {
      p_sms_id: smsId,
      p_member_id: memberId,
      p_payment_id: paymentId,
      p_confidence: confidence,
      p_status: status,
    });
  } catch (error) {
    console.error(`Error updating SMS status:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export for testing
// ═══════════════════════════════════════════════════════════════════════════

export const __testing = {
  matchByPhone,
  matchByName,
  processPayment,
  updateSmsStatus,
};
