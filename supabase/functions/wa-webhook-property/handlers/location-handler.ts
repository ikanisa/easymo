/**
 * Property Location Handler
 * Integrates location caching and saved locations for property search
 * 
 * @see supabase/functions/_shared/location/location-service.ts for unified implementation
 */

import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { LocationService } from "../../_shared/location/index.ts";

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
 * 
 * Now powered by unified LocationService!
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

  // Use unified LocationService - much simpler!
  const result = await LocationService.resolve(
    ctx.supabase,
    ctx.profileId,
    {
      source: 'property',
      cacheTTLMinutes: 30,
      preferredSavedLabel: 'home',
      customPrompt: "📍 Please share your location to find properties nearby, or use a saved location.",
    },
    ctx.locale || 'en',
  );

  // Log events for observability
  if (result.location) {
    if (result.source === 'cache') {
      logStructuredEvent("PROPERTY_LOCATION_CACHE_HIT", {
        user: ctx.profileId,
        age_minutes: result.ageMinutes,
        lat: result.location.lat,
        lng: result.location.lng,
      });
    } else if (result.source === 'saved') {
      logStructuredEvent("PROPERTY_LOCATION_SAVED_USED", {
        user: ctx.profileId,
        label: result.label,
        lat: result.location.lat,
        lng: result.location.lng,
      });
    }
  } else if (result.needsPrompt) {
    logStructuredEvent("PROPERTY_LOCATION_PROMPT_NEEDED", {
      user: ctx.profileId,
    });
  }

  return {
    location: result.location ? {
      lat: result.location.lat,
      lng: result.location.lng,
      source: result.source as 'cache' | 'saved' | 'shared',
      label: result.label,
    } : null,
    needsPrompt: result.needsPrompt,
    promptMessage: result.prompt?.message,
  };
}

/**
 * Save shared location to cache
 * 
 * Now powered by unified LocationService!
 */
export async function cachePropertyLocation(
  ctx: RouterContext,
  lat: number,
  lng: number
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const result = await LocationService.save(
    ctx.supabase,
    ctx.profileId,
    { lat, lng },
    'property',
    { action: 'property_search' },
    30,  // 30-minute TTL
  );

  if (result) {
    logStructuredEvent("PROPERTY_LOCATION_CACHED", {
      user: ctx.profileId,
      lat,
      lng,
    });
    return true;
  } else {
    logStructuredEvent("PROPERTY_CACHE_SAVE_ERROR", {
      error: "Failed to save location to cache. LocationService.save returned null. This may indicate a database RPC issue or RLS policy rejection.",
      user: ctx.profileId,
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
