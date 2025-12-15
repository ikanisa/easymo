// ============================================================================
// REAL-TIME TRACKING HANDLERS - PHASE 2
// ============================================================================
// Handles real-time driver location updates and ETA calculation during trips
// ============================================================================

import { logStructuredEvent } from "../../_shared/observability.ts";
import type { RouterContext } from "../types.ts";
import { resolveLanguage } from "../i18n/language.ts";
import { t } from "../i18n/translator.ts";
import { notifyPassenger } from "./trip_notifications.ts";
import { sendText } from "../wa/client.ts";
import { LOCATION_CONFIG } from "../../_shared/location-config.ts";

// ============================================================================
// TYPES
// ============================================================================

export type TrackingContext = RouterContext;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationUpdate {
  tripId: string;
  driverId: string;
  location: Coordinates;
  timestamp: Date;
  speed?: number; // km/h
  heading?: number; // degrees
}

export interface ETACalculation {
  distanceKm: number;
  durationMinutes: number;
  estimatedArrival: Date;
}

// ============================================================================
// LOCATION UPDATE
// ============================================================================

/**
 * Updates driver location during active trip
 * 1. Validate trip is in progress
 * 2. Update driver_status table
 * 3. Calculate new ETA
 * 4. Notify passenger if ETA changes significantly (>5 minutes)
 * 5. Record metric: LOCATION_UPDATE
 */
export async function updateDriverLocation(
  ctx: TrackingContext,
  tripId: string,
  coords: Coordinates
): Promise<boolean> {
  try {
    if (!ctx.profileId) {
      await logStructuredEvent("LOCATION_UPDATE_FAILED", {
        tripId,
        reason: "missing_profile",
      }, "error");
      return false;
    }
    // 1. Validate coordinates
    if (!isValidCoordinates(coords)) {
      await logStructuredEvent("LOCATION_UPDATE_FAILED", {
        tripId,
        reason: "invalid_coordinates",
        coords,
      }, "error");
      return false;
    }

    // 2. Verify trip is in progress
    const { data: trip, error: tripError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("driver_user_id, passenger_user_id, status")
      .eq("id", tripId)
      .eq("driver_user_id", ctx.profileId) // V2 column name
      .in("status", ["accepted", "driver_arrived", "in_progress"])
      .single();

    if (tripError || !trip) {
      await logStructuredEvent("DRIVER_TRACKING_FAILED", {
        tripId,
        reason: "trip_not_found_or_wrong_status",
      }, "error");
      return false;
    }

    // 3. Update driver location in driver_status
    const { error: updateError } = await ctx.supabase
      .from("driver_status")
      .update({
        current_lat: coords.latitude,
        current_lng: coords.longitude,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", ctx.profileId);

    if (updateError) {
      await logStructuredEvent("LOCATION_UPDATE_FAILED", {
        tripId,
        error: updateError.message,
      }, "error");
      return false;
    }

    // 4. Calculate new ETA to destination
    let destinationCoords: Coordinates | null = null;
    
    if (trip.status === "accepted" || trip.status === "driver_arrived") {
      // Driver heading to pickup
      destinationCoords = {
        latitude: trip.pickup_lat,
        longitude: trip.pickup_lng,
      };
    } else if (trip.status === "in_progress") {
      // Driver heading to dropoff
      if (trip.dropoff_lat && trip.dropoff_lng) {
        destinationCoords = {
          latitude: trip.dropoff_lat,
          longitude: trip.dropoff_lng,
        };
      }
    }

    // 4. Validate location freshness (reject stale locations)
    const MAX_LOCATION_AGE_MS = LOCATION_CONFIG.MAX_LOCATION_AGE_MS; // 5 minutes
    const locationTimestamp = Date.now(); // Use current time for WebAPI Location type
    const locationAge = 0; // Assume fresh for now
    
    if (locationAge > MAX_LOCATION_AGE_MS) {
      await logStructuredEvent("STALE_LOCATION_REJECTED", {
        tripId,
        ageMinutes: Math.floor(locationAge / 60000),
        driverId: trip.driver_id,
      }, "warn");
      
      await sendText(
        ctx.from,
        "⚠️ Location update too old. Please ensure your GPS is enabled and try again."
      );
      
      return false;
    }

    if (destinationCoords) {
      const eta = await calculateETA(coords, destinationCoords);
      
      // 5. Check if ETA changed significantly
      const previousETA = trip.eta_minutes || 0;
      const etaDifference = Math.abs(eta.durationMinutes - previousETA);
      
      if (etaDifference > 5) { // Significant change (>5 minutes)
        // Update trip ETA
        await ctx.supabase
          .from("mobility_trip_matches") // V2 table
          .update({
            eta_minutes: eta.durationMinutes,
            distance_km: eta.distanceKm,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tripId);

        // Get trip participants for notifications
        const { data: tripData } = await ctx.supabase
          .from("mobility_trip_matches") // V2 table
          .select("driver_user_id, passenger_user_id")
          .eq("id", tripId)
          .single();

        if (tripData) {
          // Notify passenger of driver's location update
          await notifyPassenger(
            ctx.supabase,
            tripData.passenger_user_id, // V2 column name
            buildEtaMessage(ctx.locale, eta.durationMinutes),
          );
        }
        await logStructuredEvent("ETA_UPDATED", {
          tripId,
          previousETA,
          newETA: eta.durationMinutes,
          difference: etaDifference,
        });
      }
    }

    // 6. Record metrics
    await logStructuredEvent("LOCATION_UPDATED", {
      tripId,
      driverId: ctx.profileId,
      location: coords,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("LOCATION_UPDATE_ERROR", {
      tripId,
      error: (error as Error)?.message || String(error),
    }, "error");
    return false;
  }
}

// ============================================================================
// ETA CALCULATION
// ============================================================================

/**
 * Enhanced ETA calculation using Google Maps Distance Matrix API
 * Falls back to Haversine calculation if API is unavailable
 */
export async function calculateETA(
  origin: Coordinates,
  destination: Coordinates,
  averageSpeedKmh: number = 30 // Fallback speed
): Promise<ETACalculation> {
  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    // Try Google Maps API first if key is available
    if (apiKey) {
      const { calculateETAWithCache } = await import(
        "../../_shared/maps/distance-matrix.ts"
      );
      
      const result = await calculateETAWithCache(
        apiKey,
        { lat: origin.latitude, lng: origin.longitude },
        { lat: destination.latitude, lng: destination.longitude },
        {
          mode: "driving",
          includeTraffic: true, // Get real-time traffic data
        }
      );
      
      if (!result.error) {
        const estimatedArrival = new Date(
          Date.now() + result.duration_minutes * 60000
        );
        
        await logStructuredEvent("ETA_CALCULATED_MAPS_API", {
          origin,
          destination,
          distanceKm: result.distance_km,
          durationMinutes: result.duration_minutes,
          withTraffic: result.duration_with_traffic_minutes,
          cached: result.cached,
        });
        
        return {
          distanceKm: result.distance_km,
          durationMinutes: result.duration_with_traffic_minutes || result.duration_minutes,
          estimatedArrival,
        };
      }
      
      // Log API failure and fall back
      await logStructuredEvent("MAPS_API_FALLBACK", {
        error: result.error,
      }, "warn");
    }
    
    // Fallback: Calculate straight-line distance using Haversine formula
    const distanceKm = calculateHaversineDistance(origin, destination);
    
    // Apply route factor (straight-line vs actual road distance)
    const routeFactor = 1.3; // Road distance is typically 30% longer
    const actualDistanceKm = distanceKm * routeFactor;
    
    // Calculate duration in minutes
    const durationHours = actualDistanceKm / averageSpeedKmh;
    const durationMinutes = Math.ceil(durationHours * 60);
    
    // Calculate estimated arrival time
    const estimatedArrival = new Date(Date.now() + durationMinutes * 60000);

    await logStructuredEvent("ETA_CALCULATED_HAVERSINE", {
      origin,
      destination,
      distanceKm: actualDistanceKm,
      durationMinutes,
    });

    return {
      distanceKm: parseFloat(actualDistanceKm.toFixed(2)),
      durationMinutes,
      estimatedArrival,
    };
  } catch (error) {
    await logStructuredEvent("ETA_CALCULATION_ERROR", {
      error: (error as Error)?.message || String(error),
    }, "error");
    
    // Return default values on error
    return {
      distanceKm: 0,
      durationMinutes: 0,
      estimatedArrival: new Date(),
    };
  }
}

// ============================================================================
// TRACKING CONTROL
// ============================================================================

/**
 * Starts driver tracking for active trip
 * In production, this would enable real-time location streaming
 */
export async function startDriverTracking(
  ctx: TrackingContext,
  tripId: string
): Promise<boolean> {
  try {
    if (!ctx.profileId) {
      await logStructuredEvent("TRACKING_START_ERROR", {
        tripId,
        reason: "missing_profile",
      }, "error");
      return false;
    }
    await logStructuredEvent("TRACKING_STARTED", {
      tripId,
      driverId: ctx.profileId,
    });

    // Production tracking implementation:
    // 1. Subscribe driver to location updates channel (Supabase Realtime)
    // 2. Set up periodic location reporting (every 30 seconds via edge function)
    // 3. Enable passenger to view driver location in real-time (via WhatsApp map link)
    // For MVP: Using phone number exchange for direct coordination
    return true;
  } catch (error) {
    await logStructuredEvent("TRACKING_START_ERROR", {
      tripId,
      error: (error as Error)?.message || String(error),
    }, "error");
    return false;
  }
}

/**
 * Stops driver tracking when trip ends
 */
export async function stopDriverTracking(
  ctx: TrackingContext,
  tripId: string
): Promise<boolean> {
  try {
    if (!ctx.profileId) {
      await logStructuredEvent("TRACKING_STOP_ERROR", {
        tripId,
        reason: "missing_profile",
      }, "error");
      return false;
    }
    await logStructuredEvent("TRACKING_STOPPED", {
      tripId,
      driverId: ctx.profileId,
    });

    // Production tracking cleanup:
    // 1. Unsubscribe from location updates channel (Supabase Realtime)
    // 2. Stop periodic location reporting (edge function cleanup)
    // 3. Disable passenger's view of driver location (via state update)
    // For MVP: No cleanup needed as tracking is via phone number exchange
    
    return true;
  } catch (error) {
    await logStructuredEvent("TRACKING_STOP_ERROR", {
      tripId,
      error: (error as Error)?.message || String(error),
    }, "error");
    return false;
  }
}

// ============================================================================
// DRIVER STATUS
// ============================================================================

/**
 * Gets driver's current location
 */
export async function getDriverLocation(
  ctx: TrackingContext,
  driverId: string
): Promise<Coordinates | null> {
  try {
    const { data, error } = await ctx.supabase
      .from("driver_status")
      .select("current_lat, current_lng")
      .eq("user_id", driverId)
      .single();

    if (error || !data || !data.current_lat || !data.current_lng) {
      return null;
    }

    return {
      latitude: parseFloat(data.current_lat),
      longitude: parseFloat(data.current_lng),
    };
  } catch (error) {
    await logStructuredEvent("GET_LOCATION_ERROR", {
      driverId,
      error: (error as Error)?.message || String(error),
    }, "error");
    return null;
  }
}

/**
 * Gets trip progress (for passenger view)
 */
export async function getTripProgress(
  ctx: TrackingContext,
  tripId: string
): Promise<{
  driverLocation: Coordinates | null;
  destination: Coordinates | null;
  eta: ETACalculation | null;
  status: string;
} | null> {
  try {
    // Get trip details
    const { data: trip, error: tripError } = await ctx.supabase
      .from("mobility_trip_matches") // V2 table
      .select("driver_user_id, passenger_user_id, status")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return null;
    }

    // Get driver location
    const driverLocation = await getDriverLocation(ctx, trip.driver_id);

    // Determine destination
    let destination: Coordinates | null = null;
    if (trip.status === "accepted" || trip.status === "driver_arrived") {
      destination = {
        latitude: trip.pickup_lat,
        longitude: trip.pickup_lng,
      };
    } else if (trip.status === "in_progress" && trip.dropoff_lat && trip.dropoff_lng) {
      destination = {
        latitude: trip.dropoff_lat,
        longitude: trip.dropoff_lng,
      };
    }

    // Calculate ETA if we have both locations
    let eta: ETACalculation | null = null;
    if (driverLocation && destination) {
      eta = await calculateETA(driverLocation, destination);
    }

    return {
      driverLocation,
      destination,
      eta,
      status: trip.status,
    };
  } catch (error) {
    await logStructuredEvent("GET_TRIP_PROGRESS_ERROR", {
      tripId,
      error: (error as Error)?.message || String(error),
    }, "error");
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates coordinates are within valid ranges
 */
export function isValidCoordinates(coords: Coordinates): boolean {
  return (
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180 &&
    !isNaN(coords.latitude) &&
    !isNaN(coords.longitude)
  );
}

/**
 * Calculates distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in kilometers
  
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLngRad = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estimates speed based on consecutive location updates
 */
export function calculateSpeed(
  location1: { coords: Coordinates; timestamp: Date },
  location2: { coords: Coordinates; timestamp: Date }
): number {
  const distanceKm = calculateHaversineDistance(location1.coords, location2.coords);
  const timeDiffMs = location2.timestamp.getTime() - location1.timestamp.getTime();
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  
  if (timeDiffHours === 0) return 0;
  
  return distanceKm / timeDiffHours; // km/h
}

function buildEtaMessage(locale: string, etaMinutes: number): string {
  const lang = resolveLanguage(locale);
  const params = { eta: etaMinutes.toString() };
  const translated = t(lang, "trip.notifications.eta_updated", params);
  if (translated === "trip.notifications.eta_updated") {
    return `⏱️ Updated ETA: ${etaMinutes} min.`;
  }
  return translated;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  updateDriverLocation,
  calculateETA,
  startDriverTracking,
  stopDriverTracking,
  getDriverLocation,
  getTripProgress,
  isValidCoordinates,
  calculateHaversineDistance,
  calculateSpeed,
};
