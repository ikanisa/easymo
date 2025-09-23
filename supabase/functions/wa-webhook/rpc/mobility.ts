import type { SupabaseClient } from "../deps.ts";

export type NearbyDriver = {
  ref_code: string;
  whatsapp_e164: string;
  last_seen: string;
};

export type NearbyPassenger = {
  trip_id: string;
  ref_code: string;
  whatsapp_e164: string;
  created_at: string;
};

export async function recentDriversNear(
  client: SupabaseClient,
  params: { lat: number; lng: number; vehicleType: string; radiusKm: number; max: number },
): Promise<NearbyDriver[]> {
  const { data, error } = await client.rpc('recent_drivers_near', {
    in_lat: params.lat,
    in_lng: params.lng,
    in_vehicle_type: params.vehicleType,
    in_radius_km: params.radiusKm,
    in_max: params.max,
  });
  if (error) throw error;
  return (data ?? []) as NearbyDriver[];
}

export async function recentPassengersNear(
  client: SupabaseClient,
  params: { lat: number; lng: number; vehicleType: string; radiusKm: number; max: number },
): Promise<NearbyPassenger[]> {
  const { data, error } = await client.rpc('recent_passenger_trips_near', {
    in_lat: params.lat,
    in_lng: params.lng,
    in_vehicle_type: params.vehicleType,
    in_radius_km: params.radiusKm,
    in_max: params.max,
  });
  if (error) throw error;
  return (data ?? []) as NearbyPassenger[];
}

export async function gateProFeature(client: SupabaseClient, userId: string) {
  const { data, error } = await client.rpc('gate_pro_feature', { _user_id: userId });
  if (error) throw error;
  if (!data || data.length === 0) return { access: false, used_credit: false, credits_left: 0 };
  return data[0] as { access: boolean; used_credit: boolean; credits_left: number };
}

export async function recordDriverPresence(
  client: SupabaseClient,
  userId: string,
  params: { vehicleType: string; lat: number; lng: number },
): Promise<void> {
  const { error } = await client
    .from('driver_status')
    .upsert({
      user_id: userId,
      vehicle_type: params.vehicleType,
      last_seen: new Date().toISOString(),
      lat: params.lat,
      lng: params.lng,
      online: true,
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function insertTrip(
  client: SupabaseClient,
  params: { userId: string; role: 'driver' | 'passenger'; vehicleType: string; lat: number; lng: number },
): Promise<string> {
  const { data, error } = await client
    .from('trips')
    .insert({
      creator_user_id: params.userId,
      role: params.role,
      vehicle_type: params.vehicleType,
      pickup_lat: params.lat,
      pickup_lng: params.lng,
      status: 'open',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id;
}

export async function updateTripDropoff(
  client: SupabaseClient,
  params: { tripId: string; lat: number; lng: number },
): Promise<void> {
  const { error } = await client
    .from('trips')
    .update({ dropoff_lat: params.lat, dropoff_lng: params.lng })
    .eq('id', params.tripId);
  if (error) throw error;
}

export async function matchDriversForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
) {
  const { data, error } = await client.rpc('match_drivers_for_trip', {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
  } as Record<string, unknown>);
  if (error) throw error;
  return data ?? [];
}

export async function matchPassengersForTrip(
  client: SupabaseClient,
  tripId: string,
  limit = 9,
  preferDropoff = false,
) {
  const { data, error } = await client.rpc('match_passengers_for_trip', {
    _trip_id: tripId,
    _limit: limit,
    _prefer_dropoff: preferDropoff,
  } as Record<string, unknown>);
  if (error) throw error;
  return data ?? [];
}
