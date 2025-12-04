// Re-export from shared for consistent API
export * from "../../_shared/wa-webhook-shared/rpc/mobility.ts";
export { MOBILITY_CONFIG } from "../../_shared/wa-webhook-shared/config/mobility.ts";

import type { SupabaseClient } from "../deps.ts";
import type { RecurrenceType } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";
import type { MatchResult } from "../../_shared/wa-webhook-shared/rpc/mobility.ts";
import { MOBILITY_CONFIG, getTripExpiryMs } from "../../_shared/wa-webhook-shared/config/mobility.ts";

// Schema validation - specific to this service for better error handling
let ridesSchemaReady = false;
let ridesSchemaCheck: Promise<void> | null = null;

async function ensureRidesTripsSchema(client: SupabaseClient): Promise<void> {
  if (ridesSchemaReady) return;
  if (ridesSchemaCheck) {
    await ridesSchemaCheck;
    return;
  }
  ridesSchemaCheck = (async () => {
    const { error } = await client
      .from("rides_trips")
      .select("creator_user_id, pickup_latitude, pickup_longitude")
      .limit(1);
    if (error) {
      ridesSchemaCheck = null;
      const reason = `RIDES_TRIPS_SCHEMA_INCOMPLETE: ${error.message ?? error.code ?? "unknown"}`;
      console.error(reason);
      throw new Error(reason);
    }
    ridesSchemaReady = true;
  })();
  await ridesSchemaCheck;
}

/**
 * Enhanced insertTrip with schema validation and additional rider/driver fields.
 * This version includes ensureRidesTripsSchema for better error handling.
 */
export async function insertTripWithValidation(
  client: SupabaseClient,
  params: {
    userId: string;
    role: "driver" | "passenger";
    vehicleType: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    pickupText?: string;
    scheduledAt?: Date | string;
    recurrence?: RecurrenceType;
  },
): Promise<string> {
  await ensureRidesTripsSchema(client);
  // For scheduled trips, use longer expiry (7 days) or default from config
  const isScheduled = params.scheduledAt !== undefined;
  const expiryMs = isScheduled ? 7 * 24 * 60 * 60 * 1000 : getTripExpiryMs();
  const expires = new Date(Date.now() + expiryMs).toISOString();
  
  const scheduledAtStr = params.scheduledAt 
    ? (params.scheduledAt instanceof Date 
        ? params.scheduledAt.toISOString() 
        : params.scheduledAt)
    : null;

  const riderUserId = params.userId;
  const driverUserId = params.role === "driver" ? params.userId : null;
  const { data, error } = await client
    .from("rides_trips")
    .insert({
      creator_user_id: params.userId,
      rider_user_id: riderUserId,
      driver_user_id: driverUserId,
      role: params.role,
      vehicle_type: params.vehicleType,
      pickup_latitude: params.lat,
      pickup_longitude: params.lng,
      pickup: `SRID=4326;POINT(${params.lng} ${params.lat})`,
      pickup_radius_m: params.radiusMeters,
      pickup_text: params.pickupText ?? null,
      status: isScheduled ? "scheduled" : "open",
      expires_at: expires,
      scheduled_at: scheduledAtStr,
      recurrence: params.recurrence ?? null,
      last_location_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id;
}

/**
 * Enhanced updateTripDropoff with schema validation.
 */
export async function updateTripDropoffWithValidation(
  client: SupabaseClient,
  params: {
    tripId: string;
    lat: number;
    lng: number;
    dropoffText?: string;
    radiusMeters?: number;
  },
): Promise<void> {
  await ensureRidesTripsSchema(client);
  const { error } = await client
    .from("rides_trips")
    .update({
      dropoff_latitude: params.lat,
      dropoff_longitude: params.lng,
      dropoff: `SRID=4326;POINT(${params.lng} ${params.lat})`,
      dropoff_text: params.dropoffText ?? null,
      dropoff_radius_m: params.radiusMeters ?? null,
    })
    .eq("id", params.tripId);
  if (error) throw error;
}

/**
 * Enhanced matchDriversForTrip with schema validation.
 */
export async function matchDriversForTripWithValidation(
  client: SupabaseClient,
  tripId: string,
  limit = MOBILITY_CONFIG.MAX_RESULTS_LIMIT,
  preferDropoff = false,
  radiusMeters?: number,
  windowDays = MOBILITY_CONFIG.DEFAULT_WINDOW_DAYS,
): Promise<MatchResult[]> {
  await ensureRidesTripsSchema(client);
  const { data, error } = await client.rpc("match_drivers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_days: windowDays,
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

/**
 * Enhanced matchPassengersForTrip with schema validation.
 */
export async function matchPassengersForTripWithValidation(
  client: SupabaseClient,
  tripId: string,
  limit = MOBILITY_CONFIG.MAX_RESULTS_LIMIT,
  preferDropoff = false,
  radiusMeters?: number,
  windowDays = MOBILITY_CONFIG.DEFAULT_WINDOW_DAYS,
): Promise<MatchResult[]> {
  await ensureRidesTripsSchema(client);
  const { data, error } = await client.rpc("match_passengers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_days: windowDays,
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}
