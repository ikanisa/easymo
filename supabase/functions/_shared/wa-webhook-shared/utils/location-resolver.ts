/**
 * Standardized Location Resolution for AI Agents
 * 
 * @deprecated This module is deprecated. Use the unified LocationService instead.
 * @see supabase/functions/_shared/location/location-service.ts
 * 
 * Critical component for all AI agents to obtain user location
 * Priority: 30-min cache → Saved locations → Prompt user
 * 
 * Migration Guide:
 * Old: resolveUserLocation(supabase, userId, { agentType: 'jobs_agent' })
 * New: LocationService.resolve(supabase, userId, { source: 'jobs_agent' })
 * 
 * @module location-resolver
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

export interface UserLocation {
  lat: number;
  lng: number;
  source: 'cache' | 'saved' | 'shared';
  label?: string; // e.g., 'home', 'work', 'school'
  address?: string;
  cached_at?: string;
  distance_from_cached?: number; // km, if using saved location
}

export interface LocationResolutionResult {
  location: UserLocation | null;
  needsPrompt: boolean;
  promptMessage?: string;
  availableSaved?: Array<{label: string; address?: string}>;
}

/**
 * Context-based location preferences
 * Maps agent type/intent to preferred saved location
 * 
 * @deprecated This hardcoded map is deprecated.
 * The new LocationService uses dynamic pattern matching instead.
 * Any service can now pass preferredSavedLabel in config.
 */
export const LOCATION_PREFERENCES = {
  // Jobs - use home location (where user lives)
  jobs_agent: 'home',
  job_search: 'home',
  job_post: 'home',
  
  // Farmers - use home location (farm location)
  farmer_agent: 'home',
  farm_supplies: 'home',
  crop_market: 'home',
  
  // Real estate - use home location initially
  real_estate_agent: 'home',
  property_search: 'home',
  
  // Business broker - flexible (check cache first)
  business_broker_agent: 'cache_first',
  business_search: 'cache_first',
  
  // Rides - always use current (cache or fresh)
  rides_agent: 'cache_first',
  ride_request: 'cache_first',
  
  // Marketplace - current location preferred
  marketplace: 'cache_first',
  
  // Waiter/Sales - current location
  waiter_agent: 'cache_first',
  restaurant_search: 'cache_first',
};

/**
 * Resolve user location with standard priority logic
 * 
 * @deprecated Use LocationService.resolve() instead
 * @see supabase/functions/_shared/location/location-service.ts
 * 
 * @param supabase - Supabase client
 * @param userId - User's profile ID
 * @param context - Agent context (agent type, intent)
 * @param cacheMinutes - Cache validity in minutes (default 30)
 * @returns Location resolution result
 * 
 * @example Migration:
 * ```typescript
 * // OLD
 * const result = await resolveUserLocation(supabase, userId, {
 *   agentType: 'jobs_agent',
 *   intent: 'job_search'
 * });
 * 
 * // NEW
 * import { LocationService } from "../../location/index.ts";
 * const result = await LocationService.resolve(supabase, userId, {
 *   source: 'jobs_agent',
 *   preferredSavedLabel: 'home',
 * });
 * ```
 */
export async function resolveUserLocation(
  supabase: SupabaseClient,
  userId: string,
  context: {
    agentType?: string;
    intent?: string;
    preferredLabel?: string; // Override: 'home', 'work', 'school'
  } = {},
  cacheMinutes: number = 30,
): Promise<LocationResolutionResult> {
  
  // STEP 1: Check 30-minute cached location (most recent)
  try {
    const { data: cached, error: cacheError } = await supabase.rpc('get_cached_location', {
      _user_id: userId,
      _cache_minutes: cacheMinutes,
    });
    
    if (!cacheError && cached && cached.length > 0 && cached[0].is_valid) {
      return {
        location: {
          lat: cached[0].lat,
          lng: cached[0].lng,
          source: 'cache',
          cached_at: cached[0].cached_at,
        },
        needsPrompt: false,
      };
    }
  } catch (error) {
    console.warn('location_resolver.cache_check_failed', error);
  }
  
  // STEP 2: Check saved locations (home/work/school)
  const preferredLabel = context.preferredLabel 
    || LOCATION_PREFERENCES[context.agentType as keyof typeof LOCATION_PREFERENCES]
    || LOCATION_PREFERENCES[context.intent as keyof typeof LOCATION_PREFERENCES]
    || 'home'; // Default to home
  
  if (preferredLabel !== 'cache_first') {
    try {
      const { data: saved, error: savedError } = await supabase
        .from('saved_locations')
        .select('label, lat, lng, address')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (!savedError && saved && saved.length > 0) {
        // Try to find preferred location (e.g., 'home')
        const preferred = saved.find(loc => loc.label === preferredLabel);
        
        if (preferred) {
          return {
            location: {
              lat: Number(preferred.lat),
              lng: Number(preferred.lng),
              source: 'saved',
              label: preferred.label,
              address: preferred.address || undefined,
            },
            needsPrompt: false,
          };
        }
        
        // If no preferred, use first saved location
        const first = saved[0];
        return {
          location: {
            lat: Number(first.lat),
            lng: Number(first.lng),
            source: 'saved',
            label: first.label,
            address: first.address || undefined,
          },
          needsPrompt: false,
          availableSaved: saved.map(s => ({ label: s.label, address: s.address || undefined })),
        };
      }
    } catch (error) {
      console.warn('location_resolver.saved_check_failed', error);
    }
  }
  
  // STEP 3: No location available - prompt user
  return {
    location: null,
    needsPrompt: true,
    promptMessage: buildLocationPrompt(context),
  };
}

/**
 * Build context-aware location prompt message
 */
function buildLocationPrompt(context: {
  agentType?: string;
  intent?: string;
}): string {
  const agentType = context.agentType || context.intent || 'search';
  
  const prompts: Record<string, string> = {
    jobs_agent: "📍 To find jobs near you, please share your location or save your home address in Profile → Saved Locations.",
    farmer_agent: "📍 To find nearby markets and suppliers, please share your farm location.",
    real_estate_agent: "📍 To find properties near you, please share your location.",
    business_broker_agent: "📍 To find nearby businesses, please share your location.",
    rides_agent: "📍 To find nearby rides, please share your current location.",
    marketplace: "📍 To browse nearby listings, please share your location.",
    waiter_agent: "📍 To find nearby restaurants, please share your location.",
  };
  
  return prompts[agentType] || "📍 Please share your location to continue.";
}

/**
 * Save location to cache after user shares
 * Call this when user shares a fresh location
 */
export async function saveLocationToCache(
  supabase: SupabaseClient,
  userId: string,
  lat: number,
  lng: number,
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_user_location_cache', {
      _user_id: userId,
      _lat: lat,
      _lng: lng,
    });
    
    if (error) {
      console.error('location_resolver.cache_save_failed', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('location_resolver.cache_save_error', error);
    return false;
  }
}

/**
 * Get all saved locations for a user
 * Useful for showing user their saved locations to choose from
 */
export async function getUserSavedLocations(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{label: string; lat: number; lng: number; address?: string}>> {
  try {
    const { data, error } = await supabase
      .from('saved_locations')
      .select('label, lat, lng, address')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data.map(loc => ({
      label: loc.label,
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      address: loc.address || undefined,
    }));
  } catch (error) {
    console.error('location_resolver.get_saved_failed', error);
    return [];
  }
}

/**
 * Check if location cache is still valid
 * Useful for conditional prompts
 */
export function isLocationCacheValid(cachedAt: string | null, minutes: number = 30): boolean {
  if (!cachedAt) return false;
  
  try {
    const cached = new Date(cachedAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - cached.getTime()) / (1000 * 60);
    return diffMinutes <= minutes;
  } catch {
    return false;
  }
}
