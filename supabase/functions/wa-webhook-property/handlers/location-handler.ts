/**
 * Property Location Handler
 * Integrates location caching and saved locations for property search
 */

import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface LocationResult {
  location: {
    lat: number;
    lng: number;
    source: 'cache' | 'saved' | 'shared';
    label?: string;
  } | null;
  needsPrompt: boolean;
  promptMessage?: string;
}

/**
 * Resolve user location with priority: cache → saved home → prompt
 */
export async function resolvePropertyLocation(
  ctx: RouterContext
): Promise<LocationResult> {
  if (!ctx.profileId) {
    return {
      location: null,
      needsPrompt: true,
      promptMessage: "Please log in to search for properties."
    };
  }

  // 1. Check location cache (30-min TTL) - using recent_locations table
  try {
    const { data: cacheData } = await ctx.supabase.rpc('get_recent_location', {
      _user_id: ctx.profileId,
      _source: 'property',
      _max_age_minutes: 30
    });

    if (cacheData && cacheData.length > 0 && cacheData[0].is_valid) {
      const row = cacheData[0];
      logStructuredEvent("PROPERTY_LOCATION_CACHE_HIT", {
        user: ctx.profileId,
        age_minutes: row.age_minutes,
        lat: row.lat,
        lng: row.lng
      });

      return {
        location: {
          lat: row.lat,
          lng: row.lng,
          source: 'cache',
          label: 'recent location'
        },
        needsPrompt: false
      };
    }
  } catch (error) {
    logStructuredEvent("PROPERTY_CACHE_CHECK_ERROR", {
      error: error instanceof Error ? error.message : String(error)
    }, "warn");
  }

  // 2. Check saved home location
  try {
    const { data: savedLoc } = await ctx.supabase
      .from('saved_locations')
      .select('lat, lng, label')
      .eq('user_id', ctx.profileId)
      .eq('label', 'home')
      .single();

    if (savedLoc?.lat && savedLoc?.lng) {
      logStructuredEvent("PROPERTY_LOCATION_SAVED_USED", {
        user: ctx.profileId,
        label: savedLoc.label,
        lat: savedLoc.lat,
        lng: savedLoc.lng
      });

      return {
        location: {
          lat: savedLoc.lat,
          lng: savedLoc.lng,
          source: 'saved',
          label: savedLoc.label || 'home'
        },
        needsPrompt: false
      };
    }
  } catch (error) {
    logStructuredEvent("PROPERTY_SAVED_CHECK_ERROR", {
      error: error instanceof Error ? error.message : String(error)
    }, "warn");
  }

  // 3. Need to prompt user
  logStructuredEvent("PROPERTY_LOCATION_PROMPT_NEEDED", {
    user: ctx.profileId
  });

  return {
    location: null,
    needsPrompt: true,
    promptMessage: "📍 Please share your location to find properties nearby, or use a saved location."
  };
}

/**
 * Save shared location to cache
 */
export async function cachePropertyLocation(
  ctx: RouterContext,
  lat: number,
  lng: number
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    await ctx.supabase.rpc('update_user_location_cache', {
      _user_id: ctx.profileId,
      _lat: lat,
      _lng: lng
    });

    logStructuredEvent("PROPERTY_LOCATION_CACHED", {
      user: ctx.profileId,
      lat,
      lng
    });

    return true;
  } catch (error) {
    logStructuredEvent("PROPERTY_CACHE_SAVE_ERROR", {
      error: error instanceof Error ? error.message : String(error)
    }, "warn");
    return false;
  }
}

/**
 * Format location context message for user
 */
export function formatLocationContext(location: LocationResult['location']): string {
  if (!location) return "";

  const { source, label } = location;
  
  if (source === 'cache') {
    return "📍 Using your recent location";
  } else if (source === 'saved') {
    return `📍 Using your ${label || 'saved'} location`;
  } else if (source === 'shared') {
    return "📍 Using your current location";
  }

  return "📍 Using your location";
}
