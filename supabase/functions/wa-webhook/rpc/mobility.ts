// Re-export core mobility functions from shared
export { MOBILITY_CONFIG } from "../../_shared/wa-webhook-shared/config/mobility.ts";
export * from "../../_shared/wa-webhook-shared/rpc/mobility.ts";

import type { SupabaseClient } from "../deps.ts";

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
