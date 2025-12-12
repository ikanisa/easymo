/**
 * Standardized Location Request Utility
 * 
 * @deprecated This module is deprecated. Use the unified LocationService instead.
 * @see supabase/functions/_shared/location/location-service.ts
 * 
 * Provides unified location sharing workflow for all services:
 * - Shows "Use Last Location" button if recent location exists
 * - Prompts for new location if needed
 * - Handles location caching automatically
 * 
 * Migration Guide:
 * Old: requestLocationWithCache(ctx, "mobility")
 * New: LocationService.resolve(supabase, userId, { source: 'mobility' })
 * 
 * Usage:
 *   import { requestLocationWithCache } from "../_shared/wa-webhook-shared/locations/request-location.ts";
 *   const result = await requestLocationWithCache(ctx, "mobility");
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { 
  getShareLocationPrompt, 
  getUseLastLocationButton,
  getLocationReusedMessage 
} from "./messages.ts";

/**
 * @deprecated Use LocationConfig.source (string) instead
 * This enum is hardcoded and doesn't scale. The new LocationService
 * accepts ANY string as source identifier.
 */
export type LocationSource = 
  | 'mobility' 
  | 'jobs' 
  | 'property' 
  | 'marketplace' 
  | 'business'
  | 'bars'
  | 'pharmacies'
  | 'shops'
  | 'notary';

export interface LocationRequestContext {
  supabase: SupabaseClient;
  userId: string;
  from: string; // WhatsApp phone number
  locale?: string;
}

export interface LocationResult {
  /** Location coordinates if available */
  location: { lat: number; lng: number } | null;
  /** Whether user needs to be prompted for location */
  needsPrompt: boolean;
  /** Message to send to user (if needsPrompt is true) */
  promptMessage?: string;
  /** Buttons to show (if needsPrompt is true) */
  promptButtons?: Array<{ id: string; title: string }>;
  /** Source of location if found */
  source?: 'cache' | 'saved' | 'shared';
  /** Age in minutes if from cache */
  ageMinutes?: number;
}

/**
 * Request location with automatic cache checking and "Use Last Location" button
 * 
 * @deprecated Use LocationService.resolve() instead
 * @see supabase/functions/_shared/location/location-service.ts
 * 
 * Flow:
 * 1. Check if user has recent location (within TTL)
 * 2. If yes, return it immediately
 * 3. If no, check if user has ANY recent location (expired but exists)
 * 4. If yes, show "Use Last Location" button + prompt
 * 5. If no, show simple location prompt
 * 
 * Migration Example:
 * ```typescript
 * // OLD
 * const result = await requestLocationWithCache(ctx, "mobility", {
 *   maxAgeMinutes: 30,
 *   preferredSavedLabel: 'home',
 * });
 * 
 * // NEW
 * import { LocationService } from "../../location/index.ts";
 * const result = await LocationService.resolve(ctx.supabase, ctx.userId, {
 *   source: 'mobility',
 *   cacheTTLMinutes: 30,
 *   preferredSavedLabel: 'home',
 * }, ctx.locale);
 * ```
 */
export async function requestLocationWithCache(
  ctx: LocationRequestContext,
  source: LocationSource,
  options: {
    /** Max age in minutes for cache (default: 30) */
    maxAgeMinutes?: number;
    /** Preferred saved location label to check (e.g., 'home') */
    preferredSavedLabel?: string;
    /** Whether to auto-use cache if valid (default: true) */
    autoUseCache?: boolean;
  } = {}
): Promise<LocationResult> {
  const {
    maxAgeMinutes = 30,
    preferredSavedLabel,
    autoUseCache = true,
  } = options;
  
  const locale = ctx.locale || 'en';

  // 1. Check recent location cache (within TTL)
  try {
    const { data: recentData } = await ctx.supabase.rpc('get_recent_location', {
      _user_id: ctx.userId,
      _source: source,
      _max_age_minutes: maxAgeMinutes,
    });

    if (recentData && recentData.length > 0 && recentData[0].is_valid && autoUseCache) {
      const row = recentData[0];
      return {
        location: { lat: row.lat, lng: row.lng },
        needsPrompt: false,
        source: 'cache',
        ageMinutes: row.age_minutes,
      };
    }
  } catch (error) {
    console.warn('Failed to check recent location cache:', error);
  }

  // 2. Check saved location if preferred label provided
  if (preferredSavedLabel) {
    try {
      const { data: savedData } = await ctx.supabase.rpc('get_saved_location', {
        _user_id: ctx.userId,
        _label: preferredSavedLabel,
      });

      if (savedData && savedData.length > 0) {
        const row = savedData[0];
        return {
          location: { lat: row.lat, lng: row.lng },
          needsPrompt: false,
          source: 'saved',
        };
      }
    } catch (error) {
      console.warn('Failed to check saved location:', error);
    }
  }

  // 3. Check if user has ANY recent location (even if expired)
  let hasAnyRecent = false;
  try {
    const { data: anyRecentData } = await ctx.supabase
      .from('recent_locations')
      .select('id')
      .eq('user_id', ctx.userId)
      .order('captured_at', { ascending: false })
      .limit(1);
    
    hasAnyRecent = anyRecentData !== null && anyRecentData.length > 0;
  } catch (error) {
    console.warn('Failed to check for any recent location:', error);
  }

  // 4. Return prompt with or without "Use Last Location" button
  const promptMessage = getShareLocationPrompt(locale, hasAnyRecent);
  const promptButtons = hasAnyRecent ? [getUseLastLocationButton(locale)] : [];

  return {
    location: null,
    needsPrompt: true,
    promptMessage,
    promptButtons,
  };
}

/**
 * Save location to cache after user shares it
 */
export async function saveSharedLocation(
  ctx: LocationRequestContext,
  coords: { lat: number; lng: number },
  source: LocationSource,
  context: Record<string, unknown> = {}
): Promise<void> {
  try {
    await ctx.supabase.rpc('save_recent_location', {
      _user_id: ctx.userId,
      _lat: coords.lat,
      _lng: coords.lng,
      _source: source,
      _context: context,
      _ttl_minutes: 30,
    });
  } catch (error) {
    console.error('Failed to save recent location:', error);
  }
}

/**
 * Handle "Use Last Location" button click
 * Returns the most recent location regardless of TTL
 */
export async function handleUseLastLocation(
  ctx: LocationRequestContext,
  source?: LocationSource
): Promise<{ lat: number; lng: number; ageMinutes: number } | null> {
  try {
    const { data } = await ctx.supabase
      .from('recent_locations')
      .select('lat, lng, captured_at')
      .eq('user_id', ctx.userId)
      .eq('source', source || null)
      .order('captured_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      const row = data[0];
      const ageMinutes = Math.floor(
        (Date.now() - new Date(row.captured_at).getTime()) / (1000 * 60)
      );
      
      return {
        lat: row.lat,
        lng: row.lng,
        ageMinutes,
      };
    }
  } catch (error) {
    console.error('Failed to retrieve last location:', error);
  }
  
  return null;
}

/**
 * Save a favorite location (home, work, etc.)
 */
export async function saveFavoriteLocation(
  ctx: LocationRequestContext,
  label: string,
  coords: { lat: number; lng: number },
  address?: string,
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await ctx.supabase.rpc('save_favorite_location', {
      _user_id: ctx.userId,
      _label: label,
      _lat: coords.lat,
      _lng: coords.lng,
      _address: address || null,
      _notes: notes || null,
    });
    
    return !error;
  } catch (error) {
    console.error('Failed to save favorite location:', error);
    return false;
  }
}

/**
 * List user's saved favorite locations
 */
export async function listFavoriteLocations(
  ctx: LocationRequestContext
): Promise<Array<{
  id: string;
  label: string;
  lat: number;
  lng: number;
  address: string | null;
  notes: string | null;
}>> {
  try {
    const { data, error } = await ctx.supabase.rpc('list_saved_locations', {
      _user_id: ctx.userId,
    });
    
    if (error) {
      console.error('Failed to list saved locations:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Failed to list saved locations:', error);
    return [];
  }
}
