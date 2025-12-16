import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

/**
 * Check if a location already exists within a specified radius
 * Uses Haversine formula to calculate distance between coordinates
 */
export async function findNearbyLocations(
  supabase: SupabaseClient,
  userId: string,
  coords: { lat: number; lng: number },
  radiusMeters = 50,
): Promise<Array<{ id: string; label: string; address: string | null; distance: number }>> {
  const { data, error } = await supabase
    .from("saved_locations")
    .select("id, label, address, lat, lng")
    .eq("user_id", userId);

  if (error || !data) {
    // Error logged by caller
    return [];
  }

  // Calculate distances using Haversine formula
  const nearby: Array<{ id: string; label: string; address: string | null; distance: number }> = [];
  
  for (const location of data) {
    const distance = calculateDistance(
      coords.lat,
      coords.lng,
      location.lat,
      location.lng,
    );
    
    if (distance <= radiusMeters) {
      nearby.push({
        id: location.id,
        label: location.label,
        address: location.address,
        distance: Math.round(distance),
      });
    }
  }

  // Sort by distance
  nearby.sort((a, b) => a.distance - b.distance);
  
  return nearby;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if location is duplicate and return appropriate message
 */
export async function checkDuplicateLocation(
  supabase: SupabaseClient,
  userId: string,
  coords: { lat: number; lng: number },
  radiusMeters = 50,
): Promise<{
  isDuplicate: boolean;
  nearbyLocations: Array<{ id: string; label: string; address: string | null; distance: number }>;
  message?: string;
}> {
  const nearby = await findNearbyLocations(supabase, userId, coords, radiusMeters);

  if (nearby.length === 0) {
    return { isDuplicate: false, nearbyLocations: [] };
  }

  const closest = nearby[0];
  const message = closest.distance === 0
    ? `You already have "${closest.label}" saved at this exact location.`
    : `You already have "${closest.label}" saved ${closest.distance}m away.`;

  return {
    isDuplicate: true,
    nearbyLocations: nearby,
    message,
  };
}
