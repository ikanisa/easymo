/**
 * Profile Cache Utility
 * 
 * Caches frequently accessed user profile data to reduce database queries.
 * Implements TTL-based expiration and LRU eviction.
 * 
 * P2-007: Add caching for frequently accessed data
 */

import { CacheManager } from "./cache.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

interface ProfileCacheEntry {
  profile_id: string;
  user_id: string;
  locale: string;
  phone: string;
}

// Global cache instance for profiles (5-minute TTL, max 1000 entries)
const profileCache = new CacheManager<ProfileCacheEntry>({
  defaultTTL: 300, // 5 minutes
  maxSize: 1000,
});

/**
 * Get or fetch user profile data with caching
 * 
 * @param supabase - Supabase client
 * @param phone - User's WhatsApp phone number
 * @param profileName - User's profile name (optional)
 * @returns Profile data or null if not found
 */
export async function getCachedProfile(
  supabase: SupabaseClient,
  phone: string,
  profileName: string = "User",
): Promise<ProfileCacheEntry | null> {
  const cacheKey = `profile:${phone}`;
  
  // Try cache first
  const cached = profileCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Cache miss - fetch from database
  try {
    const { data, error } = await supabase.rpc("ensure_whatsapp_user", {
      _wa_id: phone,
      _profile_name: profileName,
    });
    
    if (error || !data) {
      return null;
    }
    
    const profile: ProfileCacheEntry = {
      profile_id: data.profile_id || "",
      user_id: data.user_id || data.profile_id || "",
      locale: data.locale || "en",
      phone,
    };
    
    // Cache for 5 minutes
    profileCache.set(cacheKey, profile, 300);
    
    return profile;
  } catch (error) {
    // Log error but don't throw - let caller handle
    return null;
  }
}

/**
 * Invalidate profile cache for a specific phone number
 * 
 * @param phone - User's WhatsApp phone number
 */
export function invalidateProfileCache(phone: string): void {
  const cacheKey = `profile:${phone}`;
  profileCache.delete(cacheKey);
}

/**
 * Get cache statistics for monitoring
 */
export function getProfileCacheStats() {
  return profileCache.getStats();
}

