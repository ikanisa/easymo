/**
 * MOMO USSD Payment Handler
 * 
 * Handles MTN Mobile Money USSD payments for ride fares
 * Uses USSD flow: *182*7*1# for payment initiation
 */

import type { RouterContext } from "../types.ts";
import type { SupabaseClient } from "../deps.ts";
import { setState, getState, clearState } from "../state/store.ts";
import { sendText, sendInteractive } from "../wa/client.ts";
import { logEvent } from "../observe/logger.ts";

const MOMO_PAYMENT_STATE_KEY = "momo_payment";

export interface MomoPaymentState {
  tripId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  step: "phone_prompt" | "ussd_sent" | "confirming" | "completed" | "failed";
  createdAt: string;
}

/**
 * Calculate fare for a trip
 */
export async function calculateTripFare(
  client: SupabaseClient,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  vehicleType: string,
): Promise<{
  baseFare: number;
  distanceFare: number;
  totalFare: number;
  currency: string;
  distanceKm: number;
}> {
  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (dropoffLat - pickupLat) * Math.PI / 180;
  const dLng = (dropoffLng - pickupLng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // Fare calculation based on vehicle type
  const fares: Record<string, { base: number; perKm: number }> = {
    "moto": { base: 500, perKm: 200 },
    "car": { base: 1000, perKm: 400 },
    "van": { base: 1500, perKm: 500 },
    "bus": { base: 2000, perKm: 600 },
  };

  const fare = fares[vehicleType] || fares["car"];
  const baseFare = fare.base;
  const distanceFare = Math.ceil(distanceKm * fare.perKm);
  const totalFare = baseFare + distanceFare;

  return {
    baseFare,
    distanceFare,
    totalFare,
    currency: "RWF",
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
}

/**
 * Initialize MOMO payment for a trip
 */
export async function initiateTripPayment(
  ctx: RouterContext,
  tripId: string,
  amount: number,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get user's phone number
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("phone_number")
      .eq("user_id", ctx.profileId)
      .single();

    const phoneNumber = profile?.phone_number || ctx.from;

    // Set payment state
    const paymentState: MomoPaymentState = {
      tripId,
      amount,
      currency: "RWF",
      phoneNumber,
      step: "phone_prompt",
      createdAt: new Date().toISOString(),
    };

    await setState(ctx.supabase, ctx.profileId, {
      key: MOMO_PAYMENT_STATE_KEY,
      data: paymentState,
    });

    // Send payment prompt with USSD instructions
    const message = 
      `💳 *Payment Required*\n\n` +
      `Amount: ${amount.toLocaleString()} RWF\n\n` +
      `*To pay with MTN Mobile Money:*\n` +
      `1️⃣ Dial *182*7*1#\n` +
      `2️⃣ Enter Merchant Code: *easyMO*\n` +
      `3️⃣ Enter Amount: ${amount}\n` +
      `4️⃣ Confirm with your MOMO PIN\n\n` +
      `✅ After payment, reply "PAID" to confirm\n` +
      `❌ Reply "CANCEL" to cancel`;

    await sendText(ctx.from, message);

    // Update state to USSD sent
    paymentState.step = "ussd_sent";
    await setState(ctx.supabase, ctx.profileId, {
      key: MOMO_PAYMENT_STATE_KEY,
      data: paymentState,
    });

    // Log event
    await logEvent("MOMO_PAYMENT_INITIATED", {
      tripId,
      amount,
      phoneNumber,
    });

    return true;
  } catch (error) {
    await logEvent("MOMO_PAYMENT_INIT_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(ctx.from, "⚠️ Failed to initiate payment. Please try again.");
    return false;
  }
}

/**
 * Handle payment confirmation from user
 */
export async function handlePaymentConfirmation(
  ctx: RouterContext,
  confirmed: boolean,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const state = await getState(ctx.supabase, ctx.profileId);
    if (!state || state.key !== MOMO_PAYMENT_STATE_KEY) {
      await sendText(ctx.from, "⚠️ No pending payment found.");
      return false;
    }

    const paymentState = state.data as MomoPaymentState;

    if (!confirmed) {
      // User cancelled
      await clearState(ctx.supabase, ctx.profileId);
      
      // Update trip status
      await ctx.supabase
        .from("mobility_trip_matches") // V2 table
        .update({ 
          status: "cancelled",
          payment_status: "cancelled",
        })
        .eq("id", paymentState.tripId);

      await sendText(ctx.from, "❌ Payment cancelled. Trip has been cancelled.");
      
      await logEvent("MOMO_PAYMENT_CANCELLED", {
        tripId: paymentState.tripId,
      });
      
      return true;
    }

    // User confirmed payment
    paymentState.step = "confirming";
    await setState(ctx.supabase, ctx.profileId, {
      key: MOMO_PAYMENT_STATE_KEY,
      data: paymentState,
    });

    // Send verification message
    await sendText(
      ctx.from,
      "⏳ Verifying your payment...\n\nThis may take a few moments."
    );

    // Simulate payment verification (in production, query MOMO API)
    // For USSD, we rely on user confirmation + backend reconciliation
    const paymentVerified = await verifyMomoPayment(
      ctx.supabase,
      paymentState.phoneNumber,
      paymentState.amount,
    );

    if (paymentVerified) {
      // Update trip payment status
      await ctx.supabase
        .from("mobility_trip_matches") // V2 table
        .update({ 
          status: "payment_confirmed",
          payment_status: "completed",
          payment_method: "momo_ussd",
          payment_amount: paymentState.amount,
          payment_currency: paymentState.currency,
          paid_at: new Date().toISOString(),
        })
        .eq("id", paymentState.tripId);

      // Clear state
      await clearState(ctx.supabase, ctx.profileId);

      // Send success message
      await sendText(
        ctx.from,
        `✅ *Payment Confirmed!*\n\n` +
        `Amount: ${paymentState.amount.toLocaleString()} RWF\n` +
        `Trip ID: ${paymentState.tripId.substring(0, 8)}\n\n` +
        `Your driver has been notified. Safe travels! 🚗`
      );

      await logEvent("MOMO_PAYMENT_COMPLETED", {
        tripId: paymentState.tripId,
        amount: paymentState.amount,
      });

      return true;
    } else {
      // Payment not found/verified
      await sendText(
        ctx.from,
        `⚠️ *Payment Not Verified*\n\n` +
        `We couldn't verify your payment yet.\n\n` +
        `Please ensure you:\n` +
        `1. Completed the MOMO payment\n` +
        `2. Used the correct amount: ${paymentState.amount} RWF\n\n` +
        `Reply "PAID" to retry verification\n` +
        `Or "CANCEL" to cancel the trip`
      );

      return false;
    }
  } catch (error) {
    await logEvent("MOMO_PAYMENT_CONFIRM_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(ctx.from, "⚠️ Failed to confirm payment. Please try again.");
    return false;
  }
}

/**
 * Verify MOMO payment
 * In production, this would query MTN MOMO API or check reconciliation table
 */
async function verifyMomoPayment(
  client: SupabaseClient,
  phoneNumber: string,
  expectedAmount: number,
): Promise<boolean> {
  // Check momo_transactions table for recent payment
  const { data, error } = await client
    .from("momo_transactions")
    .select("*")
    .eq("phone_number", phoneNumber)
    .eq("amount", expectedAmount)
    .eq("status", "success")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    await logEvent("MOMO_VERIFY_ERROR", {
      phoneNumber,
      expectedAmount,
      error: error.message,
    });
    return false;
  }

  return data && data.length > 0;
}

/**
 * Handle refund request
 */
export async function handleRefund(
  ctx: RouterContext,
  tripId: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get trip payment details
    const { data: trip } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("payment_method, payment_amount, payment_status, passenger_id")
      .eq("id", tripId)
      .single();

    if (!trip || trip.payment_status !== "completed") {
      await sendText(ctx.from, "⚠️ No completed payment found for this trip.");
      return false;
    }

    // Create refund record
    const { error } = await ctx.supabase
      .from("momo_refunds")
      .insert({
        trip_id: tripId,
        user_id: ctx.profileId,
        amount,
        reason,
        status: "pending",
        payment_method: trip.payment_method,
      });

    if (error) {
      await logEvent("REFUND_CREATE_ERROR", {
        tripId,
        error: error.message,
      });
      await sendText(ctx.from, "⚠️ Failed to process refund request.");
      return false;
    }

    // Send confirmation
    await sendText(
      ctx.from,
      `✅ *Refund Request Submitted*\n\n` +
      `Amount: ${amount.toLocaleString()} RWF\n` +
      `Reason: ${reason}\n\n` +
      `Your refund will be processed within 3-5 business days.\n` +
      `You'll receive an SMS confirmation once completed.`
    );

    await logEvent("REFUND_REQUESTED", {
      tripId,
      amount,
      reason,
    });

    return true;
  } catch (error) {
    await logEvent("REFUND_ERROR", {
      tripId,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(ctx.from, "⚠️ Failed to process refund. Please contact support.");
    return false;
  }
}

/**
 * Get payment state
 */
export function getMomoPaymentStateKey(): string {
  return MOMO_PAYMENT_STATE_KEY;
}

/**
 * Parse payment state from stored data
 */
export function parsePaymentState(
  data: Record<string, unknown> | undefined,
): MomoPaymentState | null {
  if (!data) return null;
  
  const tripId = typeof data.tripId === "string" ? data.tripId : null;
  const amount = typeof data.amount === "number" ? data.amount : null;
  const currency = typeof data.currency === "string" ? data.currency : "RWF";
  const phoneNumber = typeof data.phoneNumber === "string" ? data.phoneNumber : null;
  const step = typeof data.step === "string" ? data.step as MomoPaymentState["step"] : "phone_prompt";
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();

  if (!tripId || !amount || !phoneNumber) return null;

  return { tripId, amount, currency, phoneNumber, step, createdAt };
}
