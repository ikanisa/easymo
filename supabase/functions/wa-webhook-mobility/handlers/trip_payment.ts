// ============================================================================
// TRIP PAYMENT HANDLER - MOMO USSD IMPLEMENTATION
// ============================================================================
// Handles trip payment using MTN Mobile Money USSD codes
// NO API integration - user-initiated USSD workflow only
// ============================================================================

import { logStructuredEvent } from "../../_shared/observability.ts";
import type { RouterContext } from "../types.ts";
import { buildMomoUssd, buildMomoUssdForQr } from "../utils/momo.ts";
import { sendText, sendImageUrl } from "../wa/client.ts";
import { buildButtons, sendButtonsMessage } from "../utils/reply.ts";
import { setState, clearState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { t } from "../i18n/translator.ts";
import { fmtCurrency } from "../utils/text.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface TripPaymentContext {
  tripId: string;
  amount: number;
  driverPhone: string;
  passengerPhone: string;
  vehicleType: string;
  role: "driver" | "passenger";
}

export interface PaymentState {
  tripId: string;
  amount: number;
  targetPhone: string;
  role: "driver" | "passenger";
  expiresAt?: string;
}

const PAYMENT_STATE_KEY = "trip_payment_pending";
const PAYMENT_CONFIRMATION_STATE_KEY = "trip_payment_confirm";
const PAYMENT_TIMEOUT_MINUTES = 15;
const DEFAULT_CURRENCY = "RWF";

// ============================================================================
// PAYMENT INITIATION
// ============================================================================

/**
 * Initiates trip payment via MOMO USSD
 * Generates USSD code and QR for user to dial
 */
export async function initiateTripPayment(
  ctx: RouterContext,
  payment: TripPaymentContext
): Promise<boolean> {
  try {
    if (!ctx.profileId) return false;

    await logStructuredEvent("TRIP_PAYMENT_INITIATED", {
      tripId: payment.tripId,
      amount: payment.amount,
      role: payment.role,
      vehicleType: payment.vehicleType,
    });

    // Determine who pays whom
    const payer = payment.role === "passenger" ? payment.passengerPhone : payment.driverPhone;
    const recipient = payment.role === "passenger" ? payment.driverPhone : payment.passengerPhone;

    // Normalize recipient phone (remove country code, keep local format)
    const recipientLocal = normalizeToLocal(recipient);
    if (!recipientLocal) {
      await sendText(
        ctx.from,
        "⚠️ Invalid phone number format. Please contact support."
      );
      return false;
    }

    // Build MOMO USSD code for standard WhatsApp button
    const { ussd: ussdStandard, telUri: telStandard } = buildMomoUssd(
      recipientLocal,
      false, // Not merchant code, it's a phone number
      payment.amount
    );

    // Build MOMO USSD code for QR (unencoded for Android compatibility)
    const { ussd: ussdQr, telUri: telQr } = buildMomoUssdForQr(
      recipientLocal,
      false,
      payment.amount
    );

    // Generate QR code image
    const qrUrl = buildQrCodeUrl(telQr);

    // Save payment state with expiration
    await setState(ctx.supabase, ctx.profileId, {
      key: PAYMENT_STATE_KEY,
      data: {
        tripId: payment.tripId,
        amount: payment.amount,
        targetPhone: recipient,
        role: payment.role,
        expiresAt: new Date(Date.now() + PAYMENT_TIMEOUT_MINUTES * 60_000).toISOString(),
      },
    });

    // Send payment instructions
    const roleName = payment.role === "passenger" ? "passenger" : "driver";
    const otherRole = payment.role === "passenger" ? "driver" : "passenger";
    const formattedAmount = fmtCurrency(payment.amount, DEFAULT_CURRENCY);

    const title = t(ctx.locale, "payment.init.title", { amount: formattedAmount });
    const instructions = t(ctx.locale, "payment.init.instructions", {
      role: roleName,
      otherRole: otherRole,
      ussd: ussdStandard,
    });

    const message = `${title}\n\n${instructions}`;

    // Send QR code first
    try {
      await sendImageUrl(ctx.from, qrUrl, "Scan to pay via MoMo");
    } catch (error) {
      await logStructuredEvent("TRIP_PAYMENT_QR_FAILED", {
        tripId: payment.tripId,
        error: error instanceof Error ? error.message : String(error),
      }, "warn");
      // Continue anyway, text fallback below
    }

    // Send message with dial button
    await sendButtonsMessage(
      ctx,
      message,
      buildButtons(
        { id: IDS.TRIP_PAYMENT_PAID, title: t(ctx.locale, "payment.init.button_paid") },
        { id: IDS.TRIP_PAYMENT_SKIP, title: t(ctx.locale, "payment.init.button_skip") }
      )
    );

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_PAYMENT_INIT_ERROR", {
      tripId: payment.tripId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendText(
      ctx.from,
      "⚠️ Failed to generate payment code. Please try again or contact support."
    );
    return false;
  }
}

// ============================================================================
// PAYMENT CONFIRMATION
// ============================================================================

/**
 * Handles payment confirmation from user
 * Verifies via transaction reference number
 */
export async function handlePaymentConfirmation(
  ctx: RouterContext,
  state: { data?: PaymentState }
): Promise<boolean> {
  try {
    if (!ctx.profileId || !state.data) return false;

    const payment = state.data;

    // Check if payment expired
    if (payment.expiresAt) {
      const expiresAt = new Date(payment.expiresAt);
      if (expiresAt < new Date()) {
        await clearState(ctx.supabase, ctx.profileId);
        await sendText(
          ctx.from,
          "⏱️ Payment session expired (15 minutes). Please start a new trip."
        );
        await logStructuredEvent("TRIP_PAYMENT_EXPIRED", {
          tripId: payment.tripId,
        }, "warn");
        return false;
      }
    }

    await logStructuredEvent("TRIP_PAYMENT_CONFIRMED", {
      tripId: payment.tripId,
      amount: payment.amount,
    });

    // Prompt for transaction reference
    await setState(ctx.supabase, ctx.profileId, {
      key: PAYMENT_CONFIRMATION_STATE_KEY,
      data: payment as unknown as Record<string, unknown>,
    });

    await sendText(
      ctx.from,
      t(ctx.locale, "payment.confirm.prompt")
    );

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_PAYMENT_CONFIRM_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Processes transaction reference submitted by user
 */
export async function processTransactionReference(
  ctx: RouterContext,
  reference: string,
  state: { data?: PaymentState }
): Promise<boolean> {
  try {
    if (!ctx.profileId || !state.data) return false;

    const payment = state.data;
    let cleanRef = reference.trim().toUpperCase().replace(/\s/g, "");

    // Handle SKIP
    if (cleanRef === "SKIP") {
      return await finalizePayment(ctx, payment, "skipped");
    }

    // Smart Validation: Auto-prepend MP if missing
    if (/^\d{9,12}$/.test(cleanRef)) {
      cleanRef = `MP${cleanRef}`;
    }

    // Validate format (MP + 9-12 digits)
    const isValid = /^MP\d{9,12}$/.test(cleanRef);

    if (!isValid) {
      // Provide specific error feedback
      let errorMsg = t(ctx.locale, "payment.error.invalid_ref");
      
      if (cleanRef.length < 11) { // MP + 9 digits = 11 chars min
        errorMsg = t(ctx.locale, "payment.error.ref_too_short");
      } else if (cleanRef.length > 14) { // MP + 12 digits = 14 chars max
        errorMsg = t(ctx.locale, "payment.error.ref_too_long");
      }

      await sendText(ctx.from, errorMsg);
      return true; // Keep state active for retry
    }

    // Success!
    return await finalizePayment(ctx, payment, "paid", cleanRef);

  } catch (error) {
    await logStructuredEvent("TRIP_PAYMENT_PROCESS_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendText(
      ctx.from,
      "⚠️ Failed to record payment. Please contact support with your transaction reference."
    );
    return false;
  }
}

/**
 * Finalizes payment state and updates database
 */
async function finalizePayment(
  ctx: RouterContext,
  payment: PaymentState,
  status: "paid" | "skipped",
  reference?: string
): Promise<boolean> {
  // Update trip payment status
  const { error: updateError } = await ctx.supabase
    .from("mobility_trip_matches") // V2 table
    .update({
      payment_status: status === "skipped" ? "pending_verification" : "paid",
      payment_reference: reference || null,
      payment_confirmed_at: status === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.tripId);

  if (updateError) throw updateError;

  // Clear state
  await clearState(ctx.supabase, ctx.profileId);

  // Send confirmation
  if (status === "skipped") {
    await sendText(ctx.from, t(ctx.locale, "payment.confirm.skipped"));
    await logStructuredEvent("TRIP_PAYMENT_SKIPPED", { tripId: payment.tripId });
  } else {
    const formattedAmount = fmtCurrency(payment.amount, DEFAULT_CURRENCY);
    await sendText(
      ctx.from,
      t(ctx.locale, "payment.confirm.success", {
        ref: reference,
        amount: formattedAmount
      })
    );
    await logStructuredEvent("TRIP_PAYMENT_RECORDED", {
      tripId: payment.tripId,
      reference,
      amount: payment.amount,
    });
  }

  return true;
}

/**
 * Checks for pending payments for a user
 * Returns the amount pending if any, or null
 */
export async function checkPendingPayments(
  ctx: RouterContext
): Promise<{ amount: number; tripId: string } | null> {
  if (!ctx.profileId) return null;

  const { data, error } = await ctx.supabase
    .from("mobility_trip_matches")
    .select("id, actual_fare, fare_estimate")
    .eq("passenger_id", ctx.profileId)
    .eq("payment_status", "pending_verification")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const amount = data.actual_fare || data.fare_estimate || 0;
  if (amount <= 0) return null;

  return { amount, tripId: data.id };
}

/**
 * Handles skip payment action
 */
export async function handleSkipPayment(
  ctx: RouterContext,
  state: { data?: PaymentState }
): Promise<boolean> {
  if (!state.data) return false;
  return await finalizePayment(ctx, state.data, "skipped");
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Normalizes phone number to local format (07XXXXXXXX)
 */
function normalizeToLocal(phone: string): string | null {
  const digitsOnly = phone.replace(/\D/g, "");

  // +250XXXXXXXXX or 250XXXXXXXXX
  if (digitsOnly.startsWith("250") && digitsOnly.length >= 12) {
    return `0${digitsOnly.slice(-9)}`;
  }

  // 07XXXXXXXX
  if (digitsOnly.startsWith("07") && digitsOnly.length === 10) {
    return digitsOnly;
  }

  // 7XXXXXXXX
  if (digitsOnly.startsWith("7") && digitsOnly.length === 9) {
    return `0${digitsOnly}`;
  }

  return null;
}

/**
 * Builds QR code URL for USSD code
 */
function buildQrCodeUrl(telUri: string): string {
  const encoded = encodeURIComponent(telUri);
  return `https://quickchart.io/qr?size=512&margin=2&text=${encoded}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const PAYMENT_STATES = {
  PENDING: PAYMENT_STATE_KEY,
  CONFIRMATION: PAYMENT_CONFIRMATION_STATE_KEY,
};

export default {
  initiateTripPayment,
  handlePaymentConfirmation,
  processTransactionReference,
  handleSkipPayment,
  PAYMENT_STATES,
};
