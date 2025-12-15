// ============================================================================
// TRIP LIFECYCLE HANDLERS - PHASE 2 IMPLEMENTATION
// ============================================================================
// Handles complete trip lifecycle: start → in-progress → complete → rating
// Target: 75% production readiness
// ============================================================================
//
// ⚠️ DEPRECATION NOTICE: These functions reference the `mobility_trip_matches`
// table which was dropped in migration 20251209093000. The simplified mobility
// flow now uses direct WhatsApp links via waChatLink() without match records.
//
// These handlers will return false until properly refactored to use the 
// simplified trips-only approach.
//
// NOTE: fare.ts has been removed per GROUND_RULES - fare calculation 
// is now handled externally. See mobility README for details.
// ============================================================================

import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import type { RouterContext } from "../types.ts";
import { resolveLanguage, type SupportedLanguage } from "../i18n/language.ts";
import { t } from "../i18n/translator.ts";
import { notifyDriver, notifyPassenger } from "./trip_notifications.ts";
import { startDriverTracking, stopDriverTracking } from "./tracking.ts";
// NOTE: calculateActualFare removed - fare.ts is prohibited per GROUND_RULES
import { initiateTripPayment } from "./trip_payment.ts";

// ============================================================================
// TYPES
// ============================================================================

export type TripLifecycleContext = RouterContext;

export interface TripStatusUpdate {
  tripId: string;
  status: TripStatus;
  timestamp: Date;
  location?: { lat: number; lng: number };
  notes?: string;
}

export type TripStatus =
  | "pending"
  | "accepted"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled_by_driver"
  | "cancelled_by_passenger"
  | "expired";

// ============================================================================
// TRIP START
// ============================================================================

/**
 * Handles trip start confirmation
 * 1. Verify both driver and passenger ready
 * 2. Update trip status to 'in_progress'
 * 3. Notify both parties
 * 4. Start real-time tracking
 * 5. Record metric: TRIP_STARTED
 */
export async function handleTripStart(
  ctx: TripLifecycleContext,
  tripId: string
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_start");
    if (!userId) return false;
    await logStructuredEvent("TRIP_START_INITIATED", { tripId, userId });

    // 1. Verify trip exists and is in accepted state
    const { data: trip, error: tripError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .eq("status", "accepted")
      .single();

    if (tripError || !trip) {
      await logStructuredEvent("TRIP_START_FAILED", { 
        tripId, 
        reason: "trip_not_found_or_wrong_status",
        error: tripError?.message 
      }, "error");
      return false;
    }

    // 2. Verify user is the driver
    if (trip.driver_id !== userId) {
      await logStructuredEvent("TRIP_START_FAILED", { 
        tripId, 
        reason: "unauthorized_user" 
      }, "error");
      return false;
    }

    // 3. Update trip status to in_progress with optimistic locking
    const { data: updated, error: updateError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("version", trip.version) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      // Check for concurrent update (optimistic lock failure)
      if (updateError.code === 'PGRST116') {
        await logStructuredEvent("TRIP_START_FAILED", { 
          tripId, 
          reason: "concurrent_update_detected",
          currentVersion: trip.version
        }, "error");
        return false;
      }
      await logStructuredEvent("TRIP_START_FAILED", { 
        tripId, 
        reason: "update_failed",
        error: updateError.message 
      }, "error");
      return false;
    }

    // 4. Notify passenger
    await notifyTripPassenger(
      ctx,
      trip.passenger_id,
      "trip.notifications.started",
      "🚗 Your driver just started the trip.",
    );

    // 5. Start tracking
    await startDriverTracking(ctx, tripId);

    // 6. Record metrics
    await logStructuredEvent("TRIP_STARTED", { 
      tripId, 
      driverId: trip.driver_id,
      passengerId: trip.passenger_id,
      vehicleType: trip.vehicle_type 
    });

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_START_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
}

// ============================================================================
// DRIVER ARRIVED AT PICKUP
// ============================================================================

/**
 * Handles driver arrival at pickup location
 * 1. Update trip status to 'driver_arrived'
 * 2. Notify passenger
 * 3. Record metric: DRIVER_ARRIVED
 */
export async function handleTripArrivedAtPickup(
  ctx: TripLifecycleContext,
  tripId: string
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_arrived");
    if (!userId) return false;
    await logStructuredEvent("DRIVER_ARRIVAL_INITIATED", { tripId });

    // 1. Get current trip state
    const { data: currentTrip } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .eq("driver_user_id", userId)
      .eq("status", "accepted")
      .single();

    if (!currentTrip) {
      await logStructuredEvent("DRIVER_ARRIVAL_FAILED", { 
        tripId, 
        reason: "trip_not_found_or_wrong_status"
      }, "error");
      return false;
    }

    // 2. Update trip status with optimistic locking
    const { data: trip, error: updateError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .update({
        status: "driver_arrived",
        arrived_at_pickup_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("version", currentTrip.version) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        await logStructuredEvent("DRIVER_ARRIVAL_FAILED", { 
          tripId, 
          reason: "concurrent_update_detected"
        }, "error");
        return false;
      }
      await logStructuredEvent("DRIVER_ARRIVAL_FAILED", { 
        tripId, 
        error: updateError.message 
      }, "error");
      return false;
    }

    // 2. Notify passenger
    await notifyTripPassenger(
      ctx,
      trip.passenger_id,
      "trip.notifications.driver_arrived",
      "✅ Your driver has arrived at the pickup point.",
    );

    // 3. Record metrics
    await logStructuredEvent("DRIVER_ARRIVED", { 
      tripId, 
      driverId: trip.driver_id,
      passengerId: trip.passenger_id 
    });

    return true;
  } catch (error) {
    await logStructuredEvent("DRIVER_ARRIVAL_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
}

// ============================================================================
// TRIP PICKED UP (START JOURNEY)
// ============================================================================

/**
 * Handles trip start (passenger picked up)
 * 1. Update trip status to 'in_progress'
 * 2. Notify passenger trip started
 * 3. Record metric: TRIP_PICKED_UP
 */
export async function handleTripPickedUp(
  ctx: TripLifecycleContext,
  tripId: string
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_picked_up");
    if (!userId) return false;
    await logStructuredEvent("TRIP_PICKUP_INITIATED", { tripId });

    // 1. Update trip status
    // Get current state for optimistic locking
    const { data: currentTrip } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .eq("driver_user_id", userId)
      .eq("status", "driver_arrived")
      .single();

    if (!currentTrip) {
      await logStructuredEvent("TRIP_PICKUP_FAILED", { 
        tripId, 
        reason: "trip_not_found_or_wrong_status"
      }, "error");
      return false;
    }

    const { data: trip, error: updateError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .update({
        status: "in_progress",
        picked_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("version", currentTrip.version) // Optimistic lock
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        await logStructuredEvent("TRIP_PICKUP_FAILED", { 
          tripId, 
          reason: "concurrent_update_detected"
        }, "error");
        return false;
      }
      await logStructuredEvent("TRIP_PICKUP_FAILED", { 
        tripId, 
        error: updateError.message 
      }, "error");
      return false;
    }

    if (!trip) {
      await logStructuredEvent("TRIP_PICKUP_FAILED", { 
        tripId, 
        reason: "trip_not_found"
      }, "error");
      return false;
    }

    // 2. Notify passenger
    await notifyTripPassenger(
      ctx,
      trip.passenger_id,
      "trip.notifications.in_progress",
      "🛣️ You're on your way.",
    );

    // 3. Record metrics
    await logStructuredEvent("TRIP_PICKED_UP", { 
      tripId, 
      driverId: trip.driver_id,
      passengerId: trip.passenger_id 
    });

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_PICKUP_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
}

// ============================================================================
// TRIP COMPLETION
// ============================================================================

/**
 * Handles trip completion
 * 1. Update trip status to 'completed'
 * 2. Calculate final fare
 * 3. Initiate payment
 * 4. Request ratings from both parties
 * 5. Record metrics: TRIP_COMPLETED, TRIP_DURATION
 */
export async function handleTripComplete(
  ctx: TripLifecycleContext,
  tripId: string
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_complete");
    if (!userId) return false;
    await logStructuredEvent("TRIP_COMPLETION_INITIATED", { tripId });

    // 1. Get trip details
    const { data: trip, error: tripError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .eq("status", "in_progress")
      .single();

    if (tripError || !trip) {
      await logStructuredEvent("TRIP_COMPLETION_FAILED", { 
        tripId, 
        reason: "trip_not_found_or_wrong_status" 
      }, "error");
      return false;
    }

    // 2. Verify user is the driver
    if (trip.driver_id !== userId) {
      await logStructuredEvent("TRIP_COMPLETION_FAILED", { 
        tripId, 
        reason: "unauthorized_user" 
      }, "error");
      return false;
    }

    // 3. Calculate trip duration
    const startedAt = new Date(trip.started_at);
    const completedAt = new Date();
    const durationMinutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);

    // 4. Calculate final fare (if not already set)
    // NOTE: fare.ts removed per GROUND_RULES - fare calculation now handled externally
    // Using estimate as fallback; actual fare should be set by external pricing service
    // Default minimum fare (1000 RWF) if no fare data available
    const DEFAULT_MINIMUM_FARE = 1000;
    let finalFare = trip.actual_fare;
    let fareStrategy = "existing_actual";
    if (!finalFare) {
      // Use fare_estimate as fallback since calculateActualFare is removed
      finalFare = trip.fare_estimate ?? DEFAULT_MINIMUM_FARE;
      fareStrategy = trip.fare_estimate ? "estimate_fallback" : "default_minimum";
      await logStructuredEvent("FARE_CALCULATION_SKIPPED", {
        tripId,
        reason: "fare_module_removed",
        usingEstimate: finalFare,
        strategy: fareStrategy,
      }, "debug");
    }

    // 5. Update trip status
    const { error: updateError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .update({
        status: "completed",
        completed_at: completedAt.toISOString(),
        duration_minutes: durationMinutes,
        actual_fare: finalFare,
        updated_at: completedAt.toISOString(),
      })
      .eq("id", tripId)
      .eq("version", trip.version); // Optimistic lock

    if (updateError) {
      await logStructuredEvent("TRIP_COMPLETION_FAILED", { 
        tripId, 
        error: updateError.message 
      }, "error");
      return false;
    }

    const fareParams: Record<string, string> = finalFare
      ? {
        amount: finalFare.toString(),
        currency: trip.currency ?? "RWF",
      }
      : {};

    await notifyTripPassenger(
      ctx,
      trip.passenger_id,
      "trip.notifications.completed",
      finalFare
        ? `✅ Trip completed. Fare: ${finalFare} ${trip.currency ?? "RWF"}.`
        : "✅ Trip completed. Thanks for riding with easyMO.",
      fareParams,
    );

    await notifyTripPassenger(
      ctx,
      trip.passenger_id,
      "trip.notifications.rate_driver",
      "🙏 Please rate your driver so we can keep rides safe and pleasant.",
    );

    await notifyTripDriver(
      ctx,
      trip.driver_id,
      "trip.notifications.completed_driver",
      "✅ Trip logged. Remember to confirm payment and rate your passenger.",
    );

    // 6. Fetch phone numbers from profiles if missing
    let driverPhone = trip.driver_phone;
    let passengerPhone = trip.passenger_phone;

    if (!driverPhone || !passengerPhone) {
      const { data: profiles } = await ctx.supabase
        .from('profiles')
        .select('user_id, whatsapp_number, phone_number')
        .in('user_id', [trip.driver_id, trip.passenger_id]);
      
      if (profiles) {
        const driverProfile = profiles.find(p => p.user_id === trip.driver_id);
        const passengerProfile = profiles.find(p => p.user_id === trip.passenger_id);
        
        driverPhone = driverPhone || driverProfile?.whatsapp_number || driverProfile?.phone_number || "";
        passengerPhone = passengerPhone || passengerProfile?.whatsapp_number || passengerProfile?.phone_number || "";
      }
    }

    // 7. Initiate payment
    await initiateTripPayment(ctx, {
      tripId,
      amount: finalFare,
      driverPhone,
      passengerPhone,
      vehicleType: trip.vehicle_type,
      role: "passenger",
    });

    // 8. Request ratings from both parties
    // Ratings are requested via notifications sent above

    // 9. Record metrics
    await logStructuredEvent("TRIP_COMPLETED", { 
      tripId, 
      driverId: trip.driver_id,
      passengerId: trip.passenger_id,
      durationMinutes,
      finalFare,
      vehicleType: trip.vehicle_type,
      fareStrategy,
    });

    // Record trip metrics
    await recordMetric("TRIP_COMPLETED", 1, { vehicleType: trip.vehicle_type });
    await recordMetric("TRIP_DURATION_SECONDS", durationMinutes * 60, { vehicleType: trip.vehicle_type });
    await recordMetric("TRIP_FARE_RWF", finalFare, { vehicleType: trip.vehicle_type });

    await stopDriverTracking(ctx, tripId);

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_COMPLETION_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
}

// ============================================================================
// TRIP CANCELLATION
// ============================================================================

/**
 * Handles trip cancellation
 * 1. Update trip status
 * 2. Calculate cancellation fee (if applicable)
 * 3. Notify other party
 * 4. Record metric: TRIP_CANCELLED
 */
export async function handleTripCancel(
  ctx: TripLifecycleContext,
  tripId: string,
  reason: string,
  cancelledBy?: "driver" | "passenger"
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_cancel");
    if (!userId) return false;
    await logStructuredEvent("TRIP_CANCELLATION_INITIATED", { 
      tripId, 
      cancelledBy: cancelledBy ?? "unknown", 
      reason 
    });

    // 1. Get trip details
    const { data: trip, error: tripError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      await logStructuredEvent("TRIP_CANCELLATION_FAILED", { 
        tripId, 
        reason: "trip_not_found" 
      }, "error");
      return false;
    }

    // 2. Verify user is authorized to cancel
    const isDriver = trip.driver_id === userId;
    const isPassenger = trip.passenger_id === userId;
    
    if (!isDriver && !isPassenger) {
      await logStructuredEvent("TRIP_CANCELLATION_FAILED", { 
        tripId, 
        reason: "unauthorized_user" 
      }, "error");
      return false;
    }

    // 3. Determine cancellation status
    const cancellationStatus = isDriver 
      ? "cancelled_by_driver" 
      : "cancelled_by_passenger";

    // 4. Calculate cancellation fee (if trip already started)
    const cancellationFee = determineCancellationFee(trip, isPassenger);

    // 5. Update trip status
    const { error: updateError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .update({
        status: cancellationStatus,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        cancelled_by_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("version", trip.version); // Optimistic lock

    if (updateError) {
      await logStructuredEvent("TRIP_CANCELLATION_FAILED", { 
        tripId, 
        error: updateError.message 
      }, "error");
      return false;
    }

    if (trip.status === "in_progress" && isDriver) {
      await stopDriverTracking(ctx, tripId);
    }

    // 6. Notify other party
    const otherPartyId = isDriver ? trip.passenger_id : trip.driver_id;
    const notificationKey = isDriver
      ? "trip.notifications.cancelled_by_driver"
      : "trip.notifications.cancelled_by_passenger";
    const feeSuffix = cancellationFee > 0
      ? ` Cancellation fee: ${cancellationFee} ${trip.currency ?? "RWF"}.`
      : "";
    const fallback = isDriver
      ? `🚫 Your driver cancelled this trip.${reason ? ` Reason: ${reason}.` : ""}`
      : `🚫 The passenger cancelled this trip.${reason ? ` Reason: ${reason}.` : ""}${feeSuffix}`;
    if (isDriver) {
      await notifyTripPassenger(ctx, otherPartyId, notificationKey, fallback, {
        reason,
      });
    } else {
      const driverParams: Record<string, string> = { reason: reason ?? "" };
      if (cancellationFee) driverParams.fee = String(cancellationFee);
      await notifyTripDriver(ctx, otherPartyId, notificationKey, fallback, driverParams);
    }

    if (cancellationFee > 0 && isPassenger) {
      await notifyTripPassenger(
        ctx,
        trip.passenger_id,
        "trip.notifications.cancellation_fee",
        `💰 A cancellation fee of ${cancellationFee} ${trip.currency ?? "RWF"} applies because your driver was already on the way.`,
        { fee: String(cancellationFee), currency: trip.currency ?? "RWF" },
      );
    }

    // 7. Record metrics
    await logStructuredEvent("TRIP_CANCELLED", { 
      tripId, 
      cancelledBy: cancellationStatus,
      reason,
      cancellationFee,
      vehicleType: trip.vehicle_type 
    });

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_CANCELLATION_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
}

// ============================================================================
// TRIP RATING
// ============================================================================

/**
 * Handles trip rating
 * 1. Validate rating (1-5)
 * 2. Insert into trip_ratings table
 * 3. Update user's average rating
 * 4. Record metric: TRIP_RATED
 */
export async function handleTripRating(
  ctx: TripLifecycleContext,
  tripId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_rating");
    if (!userId) return false;
    await logStructuredEvent("TRIP_RATING_INITIATED", { tripId, rating });

    // 1. Validate rating
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      await logStructuredEvent("TRIP_RATING_FAILED", { 
        tripId, 
        reason: "invalid_rating",
        rating 
      }, "error");
      return false;
    }

    // 2. Get trip details
    const { data: trip, error: tripError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .eq("status", "completed")
      .single();

    if (tripError || !trip) {
      await logStructuredEvent("TRIP_RATING_FAILED", { 
        tripId, 
        reason: "trip_not_found_or_not_completed" 
      }, "error");
      return false;
    }

    // 3. Determine who is being rated
    const isDriver = trip.driver_id === userId;
    const ratedUserId = isDriver ? trip.passenger_id : trip.driver_id;

    // 4. Insert rating
    const { error: insertError } = await ctx.supabase
      .from("trip_ratings")
      .insert({
        trip_id: tripId,
        rater_id: userId,
        rated_id: ratedUserId,
        rating,
        comment: comment || null,
      });

    if (insertError) {
      // Check if rating already exists
      if (insertError.code === "23505") { // Unique violation
        await logStructuredEvent("TRIP_RATING_FAILED", { 
          tripId, 
          reason: "rating_already_submitted" 
        }, "error");
      } else {
        await logStructuredEvent("TRIP_RATING_FAILED", { 
          tripId, 
          error: insertError.message 
        }, "error");
      }
      return false;
    }

    // 5. Record metrics
    await logStructuredEvent("TRIP_RATED", { 
      tripId, 
      raterId: userId,
      ratedId: ratedUserId,
      rating,
      hasComment: !!comment 
    });

    // Update cached average rating for the rated user
    // Note: This will be computed on-demand via database query
    // See: SELECT AVG(rating) FROM trip_ratings WHERE rated_user_id = $1
    // Future optimization: Store in profiles table with trigger

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_RATING_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
}

// Backward compatibility alias for older router imports
export async function handleTripRate(
  ctx: TripLifecycleContext,
  tripId: string,
  rating: number,
  comment?: string,
): Promise<boolean> {
  return await handleTripRating(ctx, tripId, rating, comment);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get trip status
 */
export async function getTripStatus(
  ctx: TripLifecycleContext,
  tripId: string
): Promise<{ status: TripStatus; trip: any } | null> {
  try {
    const { data: trip, error } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("*")
      .eq("id", tripId)
      .single();

    if (error || !trip) {
      return null;
    }

    return { status: trip.status as TripStatus, trip };
  } catch (error) {
    await logStructuredEvent("GET_TRIP_STATUS_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return null;
  }
}

/**
 * Check if user can perform action on trip
 */
export function canPerformAction(
  trip: any,
  userId: string,
  action: "start" | "arrive" | "complete" | "cancel" | "rate"
): boolean {
  const isDriver = trip.driver_id === userId;
  const isPassenger = trip.passenger_id === userId;

  switch (action) {
    case "start":
    case "arrive":
    case "complete":
      return isDriver && trip.status === "accepted";
    
    case "cancel":
      return isDriver || isPassenger;
    
    case "rate":
      return (isDriver || isPassenger) && trip.status === "completed";
    
    default:
      return false;
  }
}

function requireProfileId(
  ctx: TripLifecycleContext,
  action: string,
): string | null {
  if (ctx.profileId) return ctx.profileId;
  logStructuredEvent("TRIP_ACTION_MISSING_PROFILE", { action }, "warn");
  return null;
}

function determineCancellationFee(
  trip: any,
  cancelledByPassenger: boolean,
): number {
  if (!cancelledByPassenger) return 0;
  const estimate = Number(trip?.fare_estimate ?? 0);
  if (!Number.isFinite(estimate) || estimate <= 0) return 0;
  if (trip.status !== "driver_arrived" && trip.status !== "in_progress") {
    return 0;
  }
  return Math.max(500, Math.round(estimate * 0.2));
}

function translateTripMessage(
  locale: string,
  key: string,
  fallback: string,
  params: Record<string, string> = {},
): string {
  const lang = resolveLanguage(locale) ?? (resolveLanguage(null) as SupportedLanguage);
  const translated = t(lang, key, params);
  return translated === key ? fallback : translated;
}

async function notifyTripPassenger(
  ctx: TripLifecycleContext,
  passengerId: string,
  key: string,
  fallback: string,
  params: Record<string, string> = {},
): Promise<void> {
  const message = translateTripMessage(ctx.locale, key, fallback, params);
  await notifyPassenger(ctx.supabase, passengerId, message);
}

async function notifyTripDriver(
  ctx: TripLifecycleContext,
  driverId: string,
  key: string,
  fallback: string,
  params: Record<string, string> = {},
): Promise<void> {
  const message = translateTripMessage(ctx.locale, key, fallback, params);
  await notifyDriver(ctx.supabase, driverId, message);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  handleTripStart,
  handleTripArrivedAtPickup,
  handleTripComplete,
  handleTripCancel,
  handleTripRating,
  getTripStatus,
  canPerformAction,
};
