import type { SupabaseClient } from "../deps.ts";
import type { RecurrenceType } from "../../_shared/wa-webhook-shared/domains/intent_storage.ts";

// Trip expiry: 30 minutes for intent-based trips (real-time matching)
// Scheduled trips use longer window (7 days)
const DEFAULT_TRIP_EXPIRY_MINUTES = 30;
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
  // Guard against malformed coordinates before persisting
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error("Invalid coordinates: lat and lng must be finite numbers");
  }
  if (params.lat < -90 || params.lat > 90 || params.lng < -180 || params.lng > 180) {
    throw new Error("Invalid coordinates: lat must be [-90,90], lng must be [-180,180]");
  }

  // For scheduled trips, use longer expiry (7 days) or default 30 minutes for intent
  const isScheduled = params.scheduledAt !== undefined;
  const expiryMs = isScheduled ? 7 * 24 * 60 * 60 * 1000 : TRIP_EXPIRY_MS;
  const expires = new Date(Date.now() + expiryMs).toISOString();
  
  const scheduledAtStr = params.scheduledAt 
    ? (params.scheduledAt instanceof Date 
        ? params.scheduledAt.toISOString() 
        : params.scheduledAt)
    : null;

  const { data, error } = await client
    .from("trips") // Canonical table
    .insert({
      user_id: params.userId,
      role: params.role,
      vehicle_type: params.vehicleType,
      kind: isScheduled ? "scheduled" : "request_intent",
      pickup_lat: params.lat,
      pickup_lng: params.lng,
      pickup_text: params.pickupText ?? null,
      scheduled_for: scheduledAtStr,
      status: "open",
      expires_at: expires,
      metadata: params.recurrence ? { recurrence: params.recurrence } : {},
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
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error("Invalid dropoff coordinates: lat and lng must be finite numbers");
  }
  if (params.lat < -90 || params.lat > 90 || params.lng < -180 || params.lng > 180) {
    throw new Error("Invalid dropoff coordinates: lat must be [-90,90], lng must be [-180,180]");
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
  radiusMeters?: number,
  windowMinutes = 30, // 30-minute window for real-time matching
) {
  const { data, error } = await client.rpc("match_drivers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_minutes: windowMinutes,
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes = 30, // 30-minute window for real-time matching
) {
  const { data, error } = await client.rpc("match_passengers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
    _window_minutes: windowMinutes,
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
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
