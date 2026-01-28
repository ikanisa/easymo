/**
 * Profile Cache Utility
 * 
 * Caches frequently accessed user profile data to reduce database queries.
 * Implements TTL-based expiration and LRU eviction.
 * 
 * P2-007: Add caching for frequently accessed data
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { CacheManager } from "./cache.ts";

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
    // Try RPC function first
    const { data, error } = await supabase.rpc("ensure_whatsapp_user", {
      _wa_id: phone,
      _profile_name: profileName,
    });
    
    if (!error && data && data.length > 0) {
      // RPC function succeeded
      const profile: ProfileCacheEntry = {
        profile_id: data[0].profile_id || "",
        user_id: data[0].user_id || data[0].profile_id || "",
        locale: data[0].locale || "en",
        phone,
      };
      
      // Cache for 5 minutes
      profileCache.set(cacheKey, profile, 300);
      
      return profile;
    }
    
    // RPC function doesn't exist or returned NULL - use fallback
    if (error && error.message?.includes("does not exist")) {
      // Function doesn't exist - use ensureProfile fallback
      const { ensureProfile } = await import("../state/store.ts");
      const profileData = await ensureProfile(supabase, phone);
      
      if (profileData) {
        // Get profile ID
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", profileData.user_id)
          .maybeSingle();
        
        const profile: ProfileCacheEntry = {
          profile_id: profileRow?.id || "",
          user_id: profileData.user_id,
          locale: profileData.locale || "en",
          phone,
        };
        
        // Cache for 5 minutes
        profileCache.set(cacheKey, profile, 300);
        
        return profile;
      }
    }
    
    return null;
  } catch (error) {
    // Log error but don't throw - let caller handle
    logStructuredEvent("PROFILE_CACHE_DB_FETCH_EXCEPTION", {
      phone: `***${phone.slice(-4)}`,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
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

/**
 * Clear the profile cache (for testing purposes)
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

