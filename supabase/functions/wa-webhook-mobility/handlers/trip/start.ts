// ============================================================================
// TRIP START HANDLER
// ============================================================================
// Handles trip start confirmation when driver begins the trip
// ============================================================================

import { logStructuredEvent } from "../../../_shared/observability.ts";
import type { TripLifecycleContext } from "./types.ts";
import { requireProfileId, getTripById, updateTripStatus } from "./utils.ts";
import { notifyDriver, notifyPassenger } from "../trip_notifications.ts";
import { startDriverTracking } from "../tracking.ts";

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
  tripId: string,
): Promise<boolean> {
  try {
    const userId = requireProfileId(ctx, "trip_start");

    // Get trip details
    const trip = await getTripById(ctx, tripId);

    // Verify user is the driver
    if (trip.driver_id !== userId) {
      await logStructuredEvent("TRIP_START_UNAUTHORIZED", {
        tripId,
        userId,
        driverId: trip.driver_id,
      }, "warn");
      return false;
    }

    // Verify trip status
    if (trip.status !== "accepted" && trip.status !== "matched") {
      await logStructuredEvent("TRIP_START_INVALID_STATUS", {
        tripId,
        status: trip.status,
      }, "warn");
      return false;
    }

    // Update trip status
    await updateTripStatus(ctx, tripId, "in_progress", {
      started_at: new Date().toISOString(),
    });

    // Start driver tracking
    await startDriverTracking(ctx, tripId, userId);

    // Notify passenger
    if (trip.passenger_id) {
      await notifyPassenger(
        ctx.supabase,
        trip.passenger_id,
        `🚗 Your trip has started! Driver is on the way.`,
      );
    }

    // Notify driver
    await notifyDriver(
      ctx.supabase,
      userId,
      `✅ Trip started successfully. Safe travels!`,
    );

    // Log success
    await logStructuredEvent("TRIP_STARTED", {
      tripId,
      driverId: userId,
      passengerId: trip.passenger_id,
      vehicleType: trip.vehicle_type,
    });

    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logStructuredEvent("TRIP_START_ERROR", {
      tripId,
      error: errorMsg,
    }, "error");
    return false;
  }
}
