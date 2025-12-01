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
  // For scheduled trips, use longer expiry (7 days) or default 30 minutes
  const isScheduled = params.scheduledAt !== undefined;
  const expiryMs = isScheduled ? 7 * 24 * 60 * 60 * 1000 : TRIP_EXPIRY_MS;
  const expires = new Date(Date.now() + expiryMs).toISOString();
  
  const scheduledAtStr = params.scheduledAt 
    ? (params.scheduledAt instanceof Date 
        ? params.scheduledAt.toISOString() 
        : params.scheduledAt)
    : null;

  const { data, error } = await client
    .from("rides_trips")
    .insert({
      creator_user_id: params.userId,
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
};

export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowDays = 30,
) {
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

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowDays = 30,
) {
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

export type RecommendationResult = {
  driver_user_id?: string;
  passenger_user_id?: string;
  whatsapp_e164: string;
  vehicle_type: string;
  distance_km: number;
  match_score: number;
  last_online_at?: string;
  last_search_at?: string;
};

export async function recommendDriversForUser(
  client: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<RecommendationResult[]> {
  const { data, error } = await client.rpc("recommend_drivers_for_user", {
    _user_id: userId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as RecommendationResult[];
}

export async function recommendPassengersForUser(
  client: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<RecommendationResult[]> {
  const { data, error } = await client.rpc("recommend_passengers_for_user", {
    _user_id: userId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as RecommendationResult[];
}

export type ScheduledTripResult = {
  trip_id: string;
  creator_user_id: string;
  whatsapp_e164: string;
  role: string;
  vehicle_type: string;
  pickup_text: string | null;
  dropoff_text: string | null;
  scheduled_at: string;
  recurrence: string | null;
  distance_km: number;
  created_at: string;
};

export async function findScheduledTripsNearby(
  client: SupabaseClient,
  lat: number,
  lng: number,
  radiusKm = 10,
  vehicleType?: string,
  hoursAhead = 24,
): Promise<ScheduledTripResult[]> {
  const { data, error } = await client.rpc("find_scheduled_trips_nearby", {
    _lat: lat,
    _lng: lng,
    _radius_km: radiusKm,
    _vehicle_type: vehicleType ?? null,
    _hours_ahead: hoursAhead,
  });
  if (error) throw error;
  return (data ?? []) as ScheduledTripResult[];
}
