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

/**
 * Check if user has ANY recent location (for "Use Last Location" button)
 * This doesn't enforce the 30-min TTL - just checks if we have coordinates
 */
export async function hasAnyRecentLocation(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await client
    .from('recent_locations')
    .select('id')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(1);
  
  return data !== null && data.length > 0;
}

/**
 * Get last location regardless of TTL (for "Use Last Location" button)
 */
export async function getLastLocation(
  client: SupabaseClient,
  userId: string,
): Promise<{ lat: number; lng: number } | null> {
  const { data } = await client
    .from('recent_locations')
    .select('lat, lng')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    return { lat: data[0].lat, lng: data[0].lng };
  }
  return null;
}
