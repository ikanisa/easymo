import type { SupabaseClient } from "../deps.ts";
import type { RecurrenceType } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";

// Trip expiry: 30 minutes for intent-based trips (real-time matching)
// Scheduled trips use longer window (7 days)
const DEFAULT_TRIP_EXPIRY_MINUTES = 30;
const envExpiryMinutes = Number(Deno.env.get("MOBILITY_TRIP_EXPIRY_MINUTES"));
const TRIP_EXPIRY_MINUTES =
  Number.isFinite(envExpiryMinutes) && envExpiryMinutes > 0
    ? envExpiryMinutes
    : DEFAULT_TRIP_EXPIRY_MINUTES;
const TRIP_EXPIRY_MS = TRIP_EXPIRY_MINUTES * 60 * 1000;

// Schema check removed for V2 migration

export async function gateProFeature(client: SupabaseClient, userId: string) {
  const { data, error } = await client.rpc("gate_pro_feature", {
    _user_id: userId,
  });
  if (error) throw error;
  if (!data || data.length === 0) {
    return { access: false, used_credit: false, credits_left: 0 };
  }
  return data[0] as {
    access: boolean;
    used_credit: boolean;
    credits_left: number;
  };
}

// NOTE: recordDriverPresence removed - driver_status table dropped in simplified schema
// Drivers are now discovered through active trip records only

// SIMPLIFIED: Use create_trip RPC function instead of direct insert
export async function insertTrip(
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
    phone?: string; // Added for simplified schema
  },
): Promise<string> {
  // Guard against malformed coordinates before persisting
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error("Invalid coordinates: lat and lng must be finite numbers");
  }
  if (
    params.lat < -90 || params.lat > 90 || params.lng < -180 || params.lng > 180
  ) {
    throw new Error(
      "Invalid coordinates: lat must be [-90,90], lng must be [-180,180]",
    );
  }

  // Get phone number from params or fetch from profile
  let phone = params.phone;
  if (!phone) {
    const { data: profile } = await client
      .from("profiles")
      .select("phone_number, wa_id")
      .eq("user_id", params.userId)
      .maybeSingle();
    phone = profile?.phone_number || profile?.wa_id || "";
  }

  // Calculate scheduled time
  const scheduledFor = params.scheduledAt
    ? (params.scheduledAt instanceof Date
      ? params.scheduledAt
      : new Date(params.scheduledAt))
    : null;

  // Use simplified create_trip RPC function
  // NOTE: _vehicle parameter accepts vehicleType value (e.g., 'moto', 'car')
  // which is stored in the vehicle_type column for backward compatibility
  const { data, error } = await client.rpc("create_trip", {
    _user_id: params.userId,
    _phone: phone,
    _role: params.role,
    _vehicle: params.vehicleType, // Maps to vehicle_type column in database
    _pickup_lat: params.lat,
    _pickup_lng: params.lng,
    _pickup_text: params.pickupText ?? null,
    _dropoff_lat: null,
    _dropoff_lng: null,
    _dropoff_text: null,
    _scheduled_for: scheduledFor?.toISOString() ?? null,
  });

  if (error) throw error;
  return data as string;
}

export async function updateTripDropoff(
  client: SupabaseClient,
  params: {
    tripId: string;
    lat: number;
    lng: number;
    dropoffText?: string;
    radiusMeters?: number;
  },
): Promise<void> {
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error(
      "Invalid dropoff coordinates: lat and lng must be finite numbers",
    );
  }
  if (
    params.lat < -90 || params.lat > 90 || params.lng < -180 || params.lng > 180
  ) {
    throw new Error(
      "Invalid dropoff coordinates: lat must be [-90,90], lng must be [-180,180]",
    );
  }
  const { error } = await client
    .from("trips") // Canonical table
    .update({
      dropoff_lat: params.lat,
      dropoff_lng: params.lng,
      dropoff_text: params.dropoffText ?? null,
      dropoff_radius_m: params.radiusMeters ?? null,
    })
    .eq("id", params.tripId);
  if (error) throw error;
}

export type MatchResult = {
  trip_id: string;
  user_id: string;
  phone: string; // Now directly from trips table
  ref_code: string;
  role: "driver" | "passenger";
  vehicle: string;
  distance_km: number;
  pickup_text: string | null;
  dropoff_text: string | null;
  scheduled_for: string | null;
  created_at: string | null;
  expires_at: string | null;
};

// SIMPLIFIED: Use find_matches RPC function for both drivers and passengers
export async function findMatches(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
) {
  const { data, error } = await client.rpc("find_matches", {
    _trip_id: tripId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

// Legacy functions for backward compatibility - these now call find_matches
export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes?: number,
) {
  // Simplified: ignore complex parameters, just use find_matches
  return findMatches(client, tripId, limit);
}

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes?: number,
) {
  // Simplified: ignore complex parameters, just use find_matches
  return findMatches(client, tripId, limit);
}

export async function updateTripLocation(
  client: SupabaseClient,
  params: {
    tripId: string;
    lat: number;
    lng: number;
    pickupText?: string;
  },
): Promise<void> {
  // Validate lat/lng are finite numbers to prevent malformed geometry
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error("Invalid coordinates: lat and lng must be finite numbers");
  }
  if (
    params.lat < -90 || params.lat > 90 || params.lng < -180 || params.lng > 180
  ) {
    throw new Error(
      "Invalid coordinates: lat must be [-90,90], lng must be [-180,180]",
    );
  }
  const { error } = await client
    .from("trips") // Canonical table
    .update({
      pickup_lat: params.lat,
      pickup_lng: params.lng,
      pickup_text: params.pickupText ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.tripId);
  if (error) throw error;
}

// NOTE: createTripMatch function was removed because it referenced the deleted
// mobility_trip_matches table. The simplified flow now uses direct WhatsApp links
// via waChatLink() instead of creating match records in the database.
