// ============================================================================
// TRIP PAYMENT HANDLER - MOMO USSD IMPLEMENTATION
// ============================================================================
// Handles trip payment using MTN Mobile Money USSD codes
// NO API integration - user-initiated USSD workflow only
// ============================================================================

import { logStructuredEvent } from "../../_shared/observability.ts";
import type { RouterContext } from "../types.ts";
import type { SupabaseClient } from "../deps.ts";
import { buildMomoUssd, buildMomoUssdForQr } from "../utils/momo.ts";
import { sendText, sendImageUrl } from "../wa/client.ts";
import { buildButtons, sendButtonsMessage } from "../utils/reply.ts";
import { setState, clearState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";

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

    const message = 
      `💰 *Trip Payment - RWF ${payment.amount.toLocaleString()}*\n\n` +
      `As the ${roleName}, please pay the ${otherRole} using MTN Mobile Money:\n\n` +
      `📱 *Dial this USSD code:*\n${ussdStandard}\n\n` +
      `Or tap the button below to dial automatically.\n\n` +
      `✅ After payment, tap "Paid" to confirm.`;

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
        { id: IDS.TRIP_PAYMENT_PAID, title: "✅ Paid" },
        { id: IDS.TRIP_PAYMENT_SKIP, title: "Skip for now" }
      )
    );

    // Log payment request to database
    await logPaymentRequest(ctx.supabase, {
      tripId: payment.tripId,
      payerId: ctx.profileId,
      recipientPhone: recipient,
      amount: payment.amount,
      ussdCode: ussdStandard,
      qrUrl,
    });

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
      `✅ Great! To complete the payment record:\n\n` +
      `Please send the MTN MoMo transaction reference number (SMS confirmation code).\n\n` +
      `Example: MP123456789\n\n` +
      `Or type "SKIP" if you'll verify later.`
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

    // Validate reference format (MTN MoMo typically: MP + digits)
    const cleanRef = reference.trim().toUpperCase();
    const isValid = /^MP\d{9,12}$/.test(cleanRef);

    if (!isValid && cleanRef !== "SKIP") {
      await sendText(
        ctx.from,
        `⚠️ Invalid transaction reference format.\n\n` +
        `Expected format: MP123456789\n\n` +
        `Please try again or type SKIP.`
      );
      return true; // Keep state active
    }

    // Update trip payment status
    const { error: updateError } = await ctx.supabase
      .from("mobility_matches")
      .update({
        payment_status: cleanRef === "SKIP" ? "pending_verification" : "paid",
        payment_reference: cleanRef === "SKIP" ? null : cleanRef,
        payment_confirmed_at: cleanRef === "SKIP" ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.tripId);

    if (updateError) {
      throw updateError;
    }

    // Clear state
    await clearState(ctx.supabase, ctx.profileId);

    // Send confirmation
    if (cleanRef === "SKIP") {
      await sendText(
        ctx.from,
        `⏳ Payment marked for later verification.\n\n` +
        `You can submit the transaction reference anytime by contacting support.`
      );
    } else {
      await sendText(
        ctx.from,
        `✅ Payment recorded!\n\n` +
        `Reference: ${cleanRef}\n` +
        `Amount: RWF ${payment.amount.toLocaleString()}\n\n` +
        `Thank you for using easyMO! 🚗`
      );
    }

    await logStructuredEvent("TRIP_PAYMENT_RECORDED", {
      tripId: payment.tripId,
      reference: cleanRef,
      amount: payment.amount,
    });

    return true;
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
 * Handles skip payment action
 */
export async function handleSkipPayment(
  ctx: RouterContext,
  state: { data?: PaymentState }
): Promise<boolean> {
  try {
    if (!ctx.profileId || !state.data) return false;

    const payment = state.data;

    // Update trip to mark payment as pending
    await ctx.supabase
      .from("mobility_matches")
      .update({
        payment_status: "skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.tripId);

    // Clear state
    await clearState(ctx.supabase, ctx.profileId);

    await sendText(
      ctx.from,
      `⏭️ Payment skipped.\n\n` +
      `You can complete payment later through the trip history.\n\n` +
      `Safe travels! 🚗`
    );

    await logStructuredEvent("TRIP_PAYMENT_SKIPPED", {
      tripId: payment.tripId,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_PAYMENT_SKIP_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
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

/**
 * Logs payment request to database
 */
async function logPaymentRequest(
  client: SupabaseClient,
  data: {
    tripId: string;
    payerId: string;
    recipientPhone: string;
    amount: number;
    ussdCode: string;
    qrUrl: string;
  }
): Promise<void> {
  try {
    await client.from("trip_payment_requests").insert({
      trip_id: data.tripId,
      payer_id: data.payerId,
      recipient_phone: data.recipientPhone,
      amount_rwf: data.amount,
      ussd_code: data.ussdCode,
      qr_url: data.qrUrl,
      status: "pending",
    });
  } catch (error) {
    await logStructuredEvent("TRIP_PAYMENT_LOG_ERROR", {
      tripId: data.tripId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    // Don't throw - logging failure shouldn't break payment flow
  }
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
