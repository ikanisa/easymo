// Location caching utilities for mobility handlers
// Implements 30-minute location memory to avoid repeated location requests

import type { SupabaseClient } from "../deps.ts";

const LOCATION_CACHE_MINUTES = 30;

export interface CachedLocation {
  lat: number;
  lng: number;
  cachedAt: string;
  isValid: boolean;
}

/**
 * Save user's location to cache (profile.last_location)
 */
export async function saveLocationToCache(
  client: SupabaseClient,
  userId: string,
  coords: { lat: number; lng: number },
): Promise<void> {
  const { error } = await client.rpc("update_user_location_cache", {
    _user_id: userId,
    _lat: coords.lat,
    _lng: coords.lng,
  });
  if (error) {
    console.error("location_cache.save_fail", error);
    throw error;
  }
}

/**
 * Get cached location if still valid (within 30 minutes)
 * Returns null if no cached location or if expired
 */
export async function getCachedLocation(
  client: SupabaseClient,
  userId: string,
  cacheMinutes: number = LOCATION_CACHE_MINUTES,
): Promise<CachedLocation | null> {
  const { data, error } = await client.rpc("get_cached_location", {
    _user_id: userId,
    _cache_minutes: cacheMinutes,
  });

  if (error) {
    console.error("location_cache.get_fail", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  if (!row.is_valid) {
    return null;
  }

  return {
    lat: row.lat,
    lng: row.lng,
    cachedAt: row.cached_at,
    isValid: row.is_valid,
  };
}

/**
 * Check if user has valid cached location
 */
export async function hasValidCachedLocation(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const cached = await getCachedLocation(client, userId);
  return cached !== null && cached.isValid;
}
