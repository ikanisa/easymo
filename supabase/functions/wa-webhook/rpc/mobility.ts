// Re-export core mobility functions from shared
export { MOBILITY_CONFIG } from "../../_shared/wa-webhook-shared/config/mobility.ts";
export * from "../../_shared/wa-webhook-shared/rpc/mobility.ts";

import type { SupabaseClient } from "../deps.ts";
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
    .from("trips")
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
  number_plate?: string | null;
};

export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
  radiusMeters?: number,
) {
  const { data, error } = await client.rpc("match_drivers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
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
) {
  const { data, error } = await client.rpc("match_passengers_for_trip_v2", {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
    _radius_m: radiusMeters ?? null,
  } as Record<string, unknown>);
  if (error) throw error;
  return (data ?? []) as MatchResult[];
}

// Additional types specific to this service
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
