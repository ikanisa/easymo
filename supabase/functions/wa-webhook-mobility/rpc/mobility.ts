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
  await ensureRidesTripsSchema(client);
  // For scheduled trips, use longer expiry (7 days) or default 30 minutes
  const isScheduled = params.scheduledAt !== undefined;
  const expiryMs = isScheduled ? 7 * 24 * 60 * 60 * 1000 : TRIP_EXPIRY_MS;
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

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowDays = 30,
) {
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
