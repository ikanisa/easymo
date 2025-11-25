// ============================================================================
// TRIP LIFECYCLE HANDLERS - PHASE 2 IMPLEMENTATION
// ============================================================================
// Handles complete trip lifecycle: start → in-progress → complete → rating
// Target: 75% production readiness
// ============================================================================

import { logStructuredEvent } from "../../_shared/observability.ts";
import type { SupabaseClient } from "../deps.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface TripLifecycleContext {
  client: SupabaseClient;
  sender: string;
  profile: {
    user_id: string;
    phone_number: string;
  };
  locale: string;
}

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
    await logStructuredEvent("TRIP_START_INITIATED", { tripId, userId: ctx.profile.user_id });

    // 1. Verify trip exists and is in accepted state
    const { data: trip, error: tripError } = await ctx.client
      .from("mobility_matches")
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
    if (trip.driver_id !== ctx.profile.user_id) {
      await logStructuredEvent("TRIP_START_FAILED", { 
        tripId, 
        reason: "unauthorized_user" 
      }, "error");
      return false;
    }

    // 3. Update trip status to in_progress
    const { error: updateError } = await ctx.client
      .from("mobility_matches")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    if (updateError) {
      await logStructuredEvent("TRIP_START_FAILED", { 
        tripId, 
        reason: "update_failed",
        error: updateError.message 
      }, "error");
      return false;
    }

    // 4. Notify passenger
    // TODO: Send WhatsApp notification to passenger
    // await sendWhatsAppMessage(trip.passenger_id, {
    //   type: "text",
    //   text: t("trip.started_notification", ctx.locale),
    // });

    // 5. Start tracking (if enabled)
    // TODO: Enable real-time location updates
    // await startDriverTracking(ctx, tripId);

    // 6. Record metrics
    await logStructuredEvent("TRIP_STARTED", { 
      tripId, 
      driverId: trip.driver_id,
      passengerId: trip.passenger_id,
      vehicleType: trip.vehicle_type 
    });

    // TODO: Record metric
    // await recordMetric("TRIP_STARTED", 1, { vehicleType: trip.vehicle_type });

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
    await logStructuredEvent("DRIVER_ARRIVAL_INITIATED", { tripId });

    // 1. Update trip status
    const { data: trip, error: updateError } = await ctx.client
      .from("mobility_matches")
      .update({
        status: "driver_arrived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("driver_id", ctx.profile.user_id)
      .eq("status", "accepted")
      .select()
      .single();

    if (updateError || !trip) {
      await logStructuredEvent("DRIVER_ARRIVAL_FAILED", { 
        tripId, 
        error: updateError?.message 
      }, "error");
      return false;
    }

    // 2. Notify passenger
    // TODO: Send notification
    // await sendWhatsAppMessage(trip.passenger_id, {
    //   type: "text",
    //   text: t("trip.driver_arrived", ctx.locale),
    // });

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
    await logStructuredEvent("TRIP_COMPLETION_INITIATED", { tripId });

    // 1. Get trip details
    const { data: trip, error: tripError } = await ctx.client
      .from("mobility_matches")
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
    if (trip.driver_id !== ctx.profile.user_id) {
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
    let finalFare = trip.actual_fare;
    if (!finalFare) {
      finalFare = trip.fare_estimate; // Use estimate if no actual fare
      // TODO: Implement dynamic fare calculation based on actual distance/time
      // finalFare = await calculateActualFare(trip, durationMinutes);
    }

    // 5. Update trip status
    const { error: updateError } = await ctx.client
      .from("mobility_matches")
      .update({
        status: "completed",
        completed_at: completedAt.toISOString(),
        duration_minutes: durationMinutes,
        actual_fare: finalFare,
        updated_at: completedAt.toISOString(),
      })
      .eq("id", tripId);

    if (updateError) {
      await logStructuredEvent("TRIP_COMPLETION_FAILED", { 
        tripId, 
        error: updateError.message 
      }, "error");
      return false;
    }

    // 6. Initiate payment
    // TODO: Integrate with payment system
    // await initiateTripPayment(ctx, tripId, finalFare);

    // 7. Request ratings from both parties
    // TODO: Send rating requests
    // await requestRating(ctx, tripId, trip.driver_id, trip.passenger_id);
    // await requestRating(ctx, tripId, trip.passenger_id, trip.driver_id);

    // 8. Record metrics
    await logStructuredEvent("TRIP_COMPLETED", { 
      tripId, 
      driverId: trip.driver_id,
      passengerId: trip.passenger_id,
      durationMinutes,
      finalFare,
      vehicleType: trip.vehicle_type 
    });

    // TODO: Record metrics
    // await recordMetric("TRIP_COMPLETED", 1, { vehicleType: trip.vehicle_type });
    // await recordMetric("TRIP_DURATION_SECONDS", durationMinutes * 60, { vehicleType: trip.vehicle_type });
    // await recordMetric("TRIP_FARE_RWF", finalFare, { vehicleType: trip.vehicle_type });

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
  cancelledBy: "driver" | "passenger"
): Promise<boolean> {
  try {
    await logStructuredEvent("TRIP_CANCELLATION_INITIATED", { 
      tripId, 
      cancelledBy, 
      reason 
    });

    // 1. Get trip details
    const { data: trip, error: tripError } = await ctx.client
      .from("mobility_matches")
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
    const isDriver = trip.driver_id === ctx.profile.user_id;
    const isPassenger = trip.passenger_id === ctx.profile.user_id;
    
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
    let cancellationFee = 0;
    if (trip.status === "in_progress") {
      // TODO: Implement cancellation fee logic
      // cancellationFee = await calculateCancellationFee(trip);
    }

    // 5. Update trip status
    const { error: updateError } = await ctx.client
      .from("mobility_matches")
      .update({
        status: cancellationStatus,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    if (updateError) {
      await logStructuredEvent("TRIP_CANCELLATION_FAILED", { 
        tripId, 
        error: updateError.message 
      }, "error");
      return false;
    }

    // 6. Notify other party
    const otherPartyId = isDriver ? trip.passenger_id : trip.driver_id;
    // TODO: Send cancellation notification
    // await sendWhatsAppMessage(otherPartyId, {
    //   type: "text",
    //   text: t("trip.cancelled_notification", ctx.locale, { reason }),
    // });

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
    const { data: trip, error: tripError } = await ctx.client
      .from("mobility_matches")
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
    const isDriver = trip.driver_id === ctx.profile.user_id;
    const ratedUserId = isDriver ? trip.passenger_id : trip.driver_id;

    // 4. Insert rating
    const { error: insertError } = await ctx.client
      .from("trip_ratings")
      .insert({
        trip_id: tripId,
        rater_id: ctx.profile.user_id,
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
      raterId: ctx.profile.user_id,
      ratedId: ratedUserId,
      rating,
      hasComment: !!comment 
    });

    // TODO: Update cached average rating for the rated user
    // await updateUserAverageRating(ratedUserId);

    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_RATING_ERROR", { 
      tripId, 
      error: (error as Error)?.message || String(error) 
    }, "error");
    return false;
  }
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
    const { data: trip, error } = await ctx.client
      .from("mobility_matches")
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
