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
  whatsapp_number: string;
  ref_code: string;
  distance_m: number;
  pickup_text: string | null;
  dropoff_text: string | null;
  created_at: string;
  vehicle_type: string;
};

// Use new simplified RPC functions
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

