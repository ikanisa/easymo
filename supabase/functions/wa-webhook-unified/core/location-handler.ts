/**
 * Location Handler for Unified Service
 * 
 * Provides location resolution with the standard 3-tier approach:
 * 1. Use incoming location message (if provided)
 * 2. Check 30-minute cache
 * 3. Use saved home location
 * 
 * @see supabase/functions/wa-webhook-jobs/handlers/location.ts for reference
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface LocationData {
  lat: number;
  lng: number;
  source: "message" | "cache" | "saved";
  cached_at?: string;
  label?: string;
}

export interface LocationResolutionResult {
  location: LocationData | null;
  needs_prompt: boolean;
}

/**
 * Resolve location for a user using the 3-tier approach
 */
export async function resolveUnifiedLocation(
  supabase: SupabaseClient,
  userPhone: string,
  messageLocation?: { latitude: number; longitude: number }
): Promise<LocationResolutionResult> {
  try {
    // 1. Use incoming location message if provided
    if (messageLocation?.latitude && messageLocation?.longitude) {
      await logStructuredEvent("UNIFIED_LOCATION_FROM_MESSAGE", { userPhone });
      
      // Cache it for future use
      await cacheUnifiedLocation(supabase, userPhone, messageLocation.latitude, messageLocation.longitude);
      
      return {
        location: {
          lat: messageLocation.latitude,
          lng: messageLocation.longitude,
          source: "message",
        },
        needs_prompt: false,
      };
    }

    // Get user_id for cache/saved location queries
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("whatsapp_e164", userPhone)
      .single();

    if (!profile?.user_id) {
      return { location: null, needs_prompt: true };
    }

    // 2. Check 30-minute cache
    const { data: cached } = await supabase.rpc("get_cached_location", {
      _user_id: profile.user_id,
      _cache_minutes: 30,
    });

    if (cached && cached.length > 0 && cached[0].is_valid) {
      await logStructuredEvent("UNIFIED_LOCATION_FROM_CACHE", {
        userPhone,
        userId: profile.user_id,
      });

      return {
        location: {
          lat: cached[0].lat,
          lng: cached[0].lng,
          source: "cache",
          cached_at: cached[0].cached_at,
        },
        needs_prompt: false,
      };
    }

    // 3. Try saved home location
    const { data: savedLoc } = await supabase
      .from("saved_locations")
      .select("lat, lng, label")
      .eq("user_id", profile.user_id)
      .eq("label", "home")
      .single();

    if (savedLoc?.lat && savedLoc?.lng) {
      await logStructuredEvent("UNIFIED_LOCATION_FROM_SAVED", {
        userPhone,
        userId: profile.user_id,
        label: savedLoc.label,
      });

      return {
        location: {
          lat: savedLoc.lat,
          lng: savedLoc.lng,
          source: "saved",
          label: savedLoc.label,
        },
        needs_prompt: false,
      };
    }

    // No location available
    await logStructuredEvent("UNIFIED_LOCATION_NEEDS_PROMPT", {
      userPhone,
      userId: profile.user_id,
    });

    return {
      location: null,
      needs_prompt: true,
    };
  } catch (error) {
    await logStructuredEvent(
      "UNIFIED_LOCATION_RESOLUTION_ERROR",
      {
        error: error instanceof Error ? error.message : String(error),
        userPhone,
      },
      "error"
    );
    return { location: null, needs_prompt: true };
  }
}

/**
 * Cache location for future use (30-minute TTL)
 */
export async function cacheUnifiedLocation(
  supabase: SupabaseClient,
  userPhone: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("whatsapp_e164", userPhone)
      .single();

    if (!profile?.user_id) {
      return;
    }

    await supabase.rpc("update_user_location_cache", {
      _user_id: profile.user_id,
      _lat: lat,
      _lng: lng,
    });

    await logStructuredEvent("UNIFIED_LOCATION_CACHED", {
      userPhone,
      userId: profile.user_id,
      lat,
      lng,
    });
  } catch (error) {
    // Non-critical - log but don't fail
    await logStructuredEvent(
      "UNIFIED_LOCATION_CACHE_FAILED",
      {
        error: error instanceof Error ? error.message : String(error),
        userPhone,
      },
      "warn"
    );
  }
}

/**
 * Format location context for display to user
 */
export function formatLocationContext(location: LocationData): string {
  switch (location.source) {
    case "message":
      return "📍 Using your shared location";
    case "cache":
      return "📍 Using your recent location (from earlier today)";
    case "saved":
      return `📍 Using your ${location.label || "saved"} location`;
    default:
      return "📍 Using your location";
  }
}
