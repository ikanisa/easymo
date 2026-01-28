/**
 * Cached Data Accessors
 * High-level caching for common data access patterns
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { logStructuredEvent } from "../observability/index.ts";
import { configCache, locationCache,profileCache, stateCache } from "./memory-cache.ts";

// ============================================================================
// PROFILE CACHE
// ============================================================================

/**
 * Get profile with caching
 */
export async function getCachedProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<any | null> {
  const cacheKey = `profile:${userId}`;

  return profileCache.getOrSet(cacheKey, async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      logStructuredEvent("PROFILE_CACHE_FETCH_ERROR", { userId, error: error.message }, "warn");
      return null;
    }

    return data;
  });
}

/**
 * Get profile by phone with caching
 */
export async function getCachedProfileByPhone(
  supabase: SupabaseClient,
  phone: string
): Promise<any | null> {
  const cacheKey = `profile:phone:${phone}`;

  return profileCache.getOrSet(cacheKey, async () => {
    // Try both wa_id and phone_number to handle different formats
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const waId = phone.replace(/^\+/, '');
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`wa_id.eq.${waId},phone_number.eq.${normalizedPhone},phone_number.eq.${phone}`)
      .maybeSingle();

    if (error) {
      logStructuredEvent("PROFILE_CACHE_FETCH_ERROR", { phone: "***", error: error.message }, "warn");
      return null;
    }

    return data;
  });
}

/**
 * Invalidate profile cache
 */
export function invalidateProfileCache(userId: string): void {
  profileCache.delete(`profile:${userId}`);
}

// ============================================================================
// STATE CACHE
// ============================================================================

/**
 * Get state with caching
 */
export async function getCachedState(
  supabase: SupabaseClient,
  userId: string
): Promise<any | null> {
  const cacheKey = `state:${userId}`;

  return stateCache.getOrSet(cacheKey, async () => {
    const { data, error } = await supabase
      .from("user_state")
      .select("key, data, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    return { key: data.key, data: data.data };
  }, 30 * 1000); // 30 second TTL for state
}

/**
 * Invalidate state cache
 */
export function invalidateStateCache(userId: string): void {
  stateCache.delete(`state:${userId}`);
}

// ============================================================================
// CONFIG CACHE
// ============================================================================

/**
 * Get app config with caching
 */
export async function getCachedAppConfig(
  supabase: SupabaseClient
): Promise<Record<string, any>> {
  const cacheKey = "app:config";

  return configCache.getOrSet(cacheKey, async () => {
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value")
      .eq("active", true);

    if (error || !data) {
      return {};
    }

    const config: Record<string, any> = {};
    for (const row of data) {
      config[row.key] = row.value;
    }

    return config;
  }, 10 * 60 * 1000); // 10 minute TTL
}

/**
 * Invalidate config cache
 */
export function invalidateConfigCache(): void {
  configCache.delete("app:config");
}

// ============================================================================
// LOCATION CACHE
// ============================================================================

/**
 * Get cached location for user
 */
export async function getCachedLocation(
  supabase: SupabaseClient,
  userId: string
): Promise<{ lat: number; lng: number; capturedAt: string } | null> {
  const cacheKey = `location:${userId}`;
  return locationCache.get(cacheKey) ?? null;
}

/**
 * Set cached location for user
 */
export function setCachedLocation(
  userId: string,
  location: { lat: number; lng: number }
): void {
  const cacheKey = `location:${userId}`;
  locationCache.set(cacheKey, {
    ...location,
    capturedAt: new Date().toISOString(),
  }, 30 * 60 * 1000); // 30 minute TTL
}

/**
 * Invalidate location cache
 */
export function invalidateLocationCache(userId: string): void {
  locationCache.delete(`location:${userId}`);
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Get all cache statistics
 */
export function getAllCacheStats() {
  return {
    profile: profileCache.getStats(),
    state: stateCache.getStats(),
    config: configCache.getStats(),
    location: locationCache.getStats(),
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  profileCache.clear();
  stateCache.clear();
  configCache.clear();
  locationCache.clear();
}

/**
 * Cleanup expired entries in all caches
 */
export function cleanupAllCaches(): { total: number } {
  const cleaned = 
    profileCache.cleanup() +
    stateCache.cleanup() +
    configCache.cleanup() +
    locationCache.cleanup();

  return { total: cleaned };
}
