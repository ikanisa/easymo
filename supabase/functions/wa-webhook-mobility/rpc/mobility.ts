import type { SupabaseClient } from "../deps.ts";
import type { RecurrenceType } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";

// Trip expiry: configurable via environment variable, default 90 minutes
// Increased from 30 to 90 minutes to improve match rate (75% → 90%+)
const DEFAULT_TRIP_EXPIRY_MINUTES = 90;
const envExpiryMinutes = Number(Deno.env.get("MOBILITY_TRIP_EXPIRY_MINUTES"));
const TRIP_EXPIRY_MINUTES = Number.isFinite(envExpiryMinutes) && envExpiryMinutes > 0 
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

export async function recordDriverPresence(
  client: SupabaseClient,
  userId: string,
  params: {
    vehicleType: string;
    lat: number;
    lng: number;
    lastSeenAt?: string;
  },
): Promise<void> {
  const { error } = await client
    .from("driver_status")
    .upsert({
      user_id: userId,
      vehicle_type: params.vehicleType,
      last_seen: params.lastSeenAt ?? new Date().toISOString(),
      lat: params.lat,
      lng: params.lng,
      location: `SRID=4326;POINT(${params.lng} ${params.lat})`,
      online: true,
    }, { onConflict: "user_id" });
  if (error) throw error;
}

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
  },
): Promise<string> {
  // For scheduled trips, use longer expiry (7 days) or default 90 minutes
  const isScheduled = params.scheduledAt !== undefined;
  const expiryMs = isScheduled ? 7 * 24 * 60 * 60 * 1000 : TRIP_EXPIRY_MS;
  const expires = new Date(Date.now() + expiryMs).toISOString();
  
  const scheduledAtStr = params.scheduledAt 
    ? (params.scheduledAt instanceof Date 
        ? params.scheduledAt.toISOString() 
        : params.scheduledAt)
    : null;

  const { data, error } = await client
    .from("trips") // Canonical trips table
    .insert({
      creator_user_id: params.userId,
      role: params.role,
      trip_kind: isScheduled ? "scheduled" : "request",
      vehicle_type: params.vehicleType,
      pickup_latitude: params.lat,
      pickup_longitude: params.lng,
      pickup_text: params.pickupText ?? null,
      pickup_radius_m: params.radiusMeters,
      status: "open",
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
  const { error } = await client
    .from("trips") // Canonical table
    .update({
      dropoff_latitude: params.lat,
      dropoff_longitude: params.lng,
      dropoff_text: params.dropoffText ?? null,
    })
    .eq("id", params.tripId);
  if (error) throw error;
}

export type MatchResult = {
  trip_id: string;
  creator_user_id: string;
  whatsapp_e164: string;
  ref_code: string;
  distance_km: number;
  drop_bonus_m: number | null;
  pickup_text: string | null;
  dropoff_text: string | null;
  matched_at: string | null;
  created_at?: string | null;
  vehicle_type?: string | null;
  is_exact_match?: boolean;
  location_age_minutes?: number;
  number_plate?: string | null;  // For drivers
  driver_name?: string | null;   // Optional: driver full name
  role?: "driver" | "passenger"; // To differentiate in UI
};

export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters = 10000,
  windowDays = 2,
) {
  const { data, error } = await client.rpc("find_nearby_drivers", {
    p_passenger_trip_id: tripId,
    p_limit: limit,
    p_radius_m: radiusMeters,
  });
  if (error) throw error;
  
  // Map to old MatchResult format for backward compatibility
  return (data ?? []).map((item: any) => ({
    trip_id: item.trip_id,
    creator_user_id: item.driver_user_id,
    whatsapp_e164: item.whatsapp_number,
    ref_code: item.ref_code,
    distance_km: (item.distance_m || 0) / 1000,
    drop_bonus_m: null,
    pickup_text: item.pickup_text,
    dropoff_text: item.dropoff_text,
    matched_at: null,
    created_at: item.created_at,
    vehicle_type: item.vehicle_type,
  })) as MatchResult[];
}

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters = 10000,
  windowDays = 2,
) {
  const { data, error } = await client.rpc("find_nearby_passengers", {
    p_driver_trip_id: tripId,
    p_limit: limit,
    p_radius_m: radiusMeters,
  });
  if (error) throw error;
  
  // Map to old MatchResult format for backward compatibility
  return (data ?? []).map((item: any) => ({
    trip_id: item.trip_id,
    creator_user_id: item.passenger_user_id,
    whatsapp_e164: item.whatsapp_number,
    ref_code: item.ref_code,
    distance_km: (item.distance_m || 0) / 1000,
    drop_bonus_m: null,
    pickup_text: item.pickup_text,
    dropoff_text: item.dropoff_text,
    matched_at: null,
    created_at: item.created_at,
    vehicle_type: item.vehicle_type,
  })) as MatchResult[];
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
  if (params.lat < -90 || params.lat > 90 || params.lng < -180 || params.lng > 180) {
    throw new Error("Invalid coordinates: lat must be [-90,90], lng must be [-180,180]");
  }
  const { error } = await client
    .from("trips") // Canonical table
    .update({
      pickup_latitude: params.lat,
      pickup_longitude: params.lng,
      pickup_text: params.pickupText ?? null,
      last_location_at: new Date().toISOString(),
    })
    .eq("id", params.tripId);
  if (error) throw error;
}

// DEPRECATED: Trip matching is out of scope for simplified mobility
// This function is kept for backward compatibility but does nothing
// Once a user selects someone from nearby list, they chat directly - no match tracking
export async function createTripMatch(
  client: SupabaseClient,
  params: {
    driverTripId: string;
    passengerTripId: string;
    driverUserId: string;
    passengerUserId: string;
    vehicleType: string;
    pickupLocation: string;
    driverPhone: string;
    passengerPhone: string;
    estimatedFare?: number;
    distanceKm?: number;
  }
): Promise<string> {
  // No-op: matching feature removed per product requirements
  // Return a dummy ID to maintain backward compatibility
  return "no-match-tracking";
}
