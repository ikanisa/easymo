import type { SupabaseClient } from "../deps.ts";

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
  },
): Promise<string> {
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
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
      status: "open",
      expires_at: expires,
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
  vehicle_type?: string | null;
  is_exact_match?: boolean;
  location_age_minutes?: number;
};

export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
  windowMinutes = 30,
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
  windowMinutes = 30,
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
