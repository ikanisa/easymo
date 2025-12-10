/**
 * Unified Location Service
 * 
 * Single source of truth for all location operations across EasyMO.
 * FULLY DYNAMIC - No hardcoded source enums!
 * 
 * @module location/location-service
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  LocationConfig,
  LocationResult,
  NearbyResult,
  SavedLocation,
  RecentLocation,
  Locale,
} from "./types.ts";

// Default TTL values
const DEFAULT_CACHE_TTL_MINUTES = 30;
const DEFAULT_SEARCH_RADIUS_METERS = 10_000; // 10km

/**
 * Multilingual prompts for location sharing
 */
const LOCATION_PROMPTS: Record<Locale, {
  default: string;
  withRecent: string;
  useLastButton: string;
}> = {
  en: {
    default: "📍 Please share your location to continue.",
    withRecent: "📍 Share your location, or use your last location.",
    useLastButton: "Use Last Location",
  },
  fr: {
    default: "📍 Veuillez partager votre emplacement pour continuer.",
    withRecent: "📍 Partagez votre emplacement ou utilisez votre dernière position.",
    useLastButton: "Utiliser la dernière position",
  },
  rw: {
    default: "📍 Nyamuneka sangiza aho uri kugirango ukomeze.",
    withRecent: "📍 Sangiza aho uri, cyangwa ukoreshe aho wari uhereyeho.",
    useLastButton: "Koresha aho wari",
  },
};

/**
 * Generate context-aware prompt message based on source pattern
 */
function buildPromptMessage(
  source: string,
  locale: Locale,
  customPrompt?: string,
): string {
  if (customPrompt) {
    return customPrompt;
  }

  // Pattern matching for common service types (not hardcoded!)
  const lowerSource = source.toLowerCase();
  
  if (lowerSource.includes('job')) {
    return locale === 'en' 
      ? "📍 Share your location to find jobs near you."
      : locale === 'fr'
      ? "📍 Partagez votre emplacement pour trouver des emplois près de chez vous."
      : "📍 Sangiza aho uri kugirango ubone imirimo hafi yawe.";
  }
  
  if (lowerSource.includes('property') || lowerSource.includes('real_estate')) {
    return locale === 'en'
      ? "📍 Share your location to find properties nearby."
      : locale === 'fr'
      ? "📍 Partagez votre emplacement pour trouver des propriétés à proximité."
      : "📍 Sangiza aho uri kugirango ubone imitungo hafi yawe.";
  }
  
  if (lowerSource.includes('mobility') || lowerSource.includes('ride')) {
    return locale === 'en'
      ? "📍 Share your location to find rides nearby."
      : locale === 'fr'
      ? "📍 Partagez votre emplacement pour trouver des trajets à proximité."
      : "📍 Sangiza aho uri kugirango ubone ingendo hafi yawe.";
  }
  
  if (lowerSource.includes('market') || lowerSource.includes('shop')) {
    return locale === 'en'
      ? "📍 Share your location to browse nearby listings."
      : locale === 'fr'
      ? "📍 Partagez votre emplacement pour parcourir les annonces à proximité."
      : "📍 Sangiza aho uri kugirango urebe ibintu biri hafi yawe.";
  }

  // Default generic prompt
  return LOCATION_PROMPTS[locale].default;
}

/**
 * Unified Location Service
 * 
 * Main entry point for all location operations.
 */
export class LocationService {
  /**
   * Resolve user location with smart fallback logic
   * 
   * Priority: Valid Cache → Preferred Saved → Any Saved → Prompt User
   * 
   * @param supabase Supabase client
   * @param userId User's profile ID
   * @param config Location configuration
   * @param locale User's locale (default: 'en')
   * @returns Location resolution result
   * 
   * @example
   * ```typescript
   * // WhatsApp Mobility
   * const result = await LocationService.resolve(supabase, userId, {
   *   source: 'mobility',
   *   preferredSavedLabel: 'home',
   * }, 'en');
   * 
   * // AI Agent
   * const result = await LocationService.resolve(supabase, userId, {
   *   source: 'jobs_agent',
   *   customPrompt: '📍 Share location to find jobs.',
   * });
   * 
   * // NEW service - NO CODE CHANGES!
   * const result = await LocationService.resolve(supabase, userId, {
   *   source: 'pet_adoption_2025',
   *   cacheTTLMinutes: 60,
   * });
   * ```
   */
  static async resolve(
    supabase: SupabaseClient,
    userId: string,
    config: LocationConfig,
    locale: Locale = 'en',
  ): Promise<LocationResult> {
    const {
      source,
      cacheTTLMinutes = DEFAULT_CACHE_TTL_MINUTES,
      preferredSavedLabel,
      autoUseCache = true,
      customPrompt,
    } = config;

    // STEP 1: Check recent location cache (within TTL)
    if (autoUseCache) {
      try {
        const { data: recentData } = await supabase.rpc('get_recent_location', {
          _user_id: userId,
          _source: source,
          _max_age_minutes: cacheTTLMinutes,
        });

        if (recentData && recentData.length > 0 && recentData[0].is_valid) {
          const row = recentData[0];
          return {
            location: { lat: row.lat, lng: row.lng },
            needsPrompt: false,
            source: 'cache',
            ageMinutes: row.age_minutes,
          };
        }
      } catch (error) {
        console.warn('[LocationService] Cache check failed:', error);
      }
    }

    // STEP 2: Check preferred saved location
    if (preferredSavedLabel) {
      try {
        const { data: savedData } = await supabase.rpc('get_saved_location', {
          _user_id: userId,
          _label: preferredSavedLabel,
        });

        if (savedData && savedData.length > 0) {
          const row = savedData[0];
          return {
            location: { lat: row.lat, lng: row.lng },
            needsPrompt: false,
            source: 'saved',
            label: row.label,
          };
        }
      } catch (error) {
        console.warn('[LocationService] Saved location check failed:', error);
      }
    }

    // STEP 3: Check any saved location
    try {
      const { data: anySaved } = await supabase
        .from('saved_locations')
        .select('label, lat, lng')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (anySaved && anySaved.length > 0) {
        const row = anySaved[0];
        return {
          location: { lat: Number(row.lat), lng: Number(row.lng) },
          needsPrompt: false,
          source: 'saved',
          label: row.label,
        };
      }
    } catch (error) {
      console.warn('[LocationService] Any saved location check failed:', error);
    }

    // STEP 4: Check if user has ANY recent location (for "Use Last" button)
    let hasAnyRecent = false;
    try {
      const { data: anyRecentData } = await supabase
        .from('recent_locations')
        .select('id')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .limit(1);
      
      hasAnyRecent = anyRecentData !== null && anyRecentData.length > 0;
    } catch (error) {
      console.warn('[LocationService] Recent location check failed:', error);
    }

    // STEP 5: Prompt user for location
    const promptMessage = hasAnyRecent
      ? (customPrompt || LOCATION_PROMPTS[locale].withRecent)
      : buildPromptMessage(source, locale, customPrompt);

    const promptButtons = hasAnyRecent
      ? [{ id: 'use_last_location', title: LOCATION_PROMPTS[locale].useLastButton }]
      : [];

    return {
      location: null,
      needsPrompt: true,
      source: null,
      prompt: {
        message: promptMessage,
        buttons: promptButtons,
        hasRecentLocation: hasAnyRecent,
      },
    };
  }

  /**
   * Save location to cache
   * 
   * @param supabase Supabase client
   * @param userId User's profile ID
   * @param coords Location coordinates
   * @param source Service identifier
   * @param context Additional context (optional)
   * @param ttlMinutes Cache TTL in minutes (default: 30)
   */
  static async save(
    supabase: SupabaseClient,
    userId: string,
    coords: { lat: number; lng: number },
    source: string,
    context?: Record<string, unknown>,
    ttlMinutes: number = DEFAULT_CACHE_TTL_MINUTES,
  ): Promise<RecentLocation | null> {
    try {
      const { data, error } = await supabase.rpc('save_recent_location', {
        _user_id: userId,
        _lat: coords.lat,
        _lng: coords.lng,
        _source: source,
        _context: context ? JSON.stringify(context) : null,
        _ttl_minutes: ttlMinutes,
      });

      if (error) {
        console.error('[LocationService] Save failed:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('[LocationService] Save error:', error);
      return null;
    }
  }

  /**
   * Save a favorite location
   * 
   * @param supabase Supabase client
   * @param userId User's profile ID
   * @param label Location label (e.g., 'home', 'work')
   * @param coords Location coordinates
   * @param address Optional address
   * @param notes Optional notes
   */
  static async saveFavorite(
    supabase: SupabaseClient,
    userId: string,
    label: string,
    coords: { lat: number; lng: number },
    address?: string,
    notes?: string,
  ): Promise<SavedLocation | null> {
    try {
      const { data, error } = await supabase.rpc('save_favorite_location', {
        _user_id: userId,
        _label: label,
        _lat: coords.lat,
        _lng: coords.lng,
        _address: address || null,
        _notes: notes || null,
      });

      if (error) {
        console.error('[LocationService] Save favorite failed:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('[LocationService] Save favorite error:', error);
      return null;
    }
  }

  /**
   * Get all favorite locations for a user
   * 
   * @param supabase Supabase client
   * @param userId User's profile ID
   */
  static async getFavorites(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<SavedLocation[]> {
    try {
      const { data, error } = await supabase.rpc('list_saved_locations', {
        _user_id: userId,
      });

      if (error) {
        console.error('[LocationService] Get favorites failed:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[LocationService] Get favorites error:', error);
      return [];
    }
  }

  /**
   * Find nearby items (generic nearby search)
   * 
   * **NOTE**: This is a basic implementation that doesn't perform geospatial filtering.
   * For production use with spatial queries, use dedicated RPC functions like:
   * - `search_nearby_jobs(lat, lng, radius_km)`
   * - `find_nearby_properties(lat, lng, radius_meters)`
   * 
   * This method is primarily for simple table queries with manual filtering.
   * 
   * @param supabase Supabase client
   * @param coords Search center coordinates
   * @param options Search options
   * @returns Nearby search result
   * 
   * @example
   * ```typescript
   * // For actual spatial queries, use dedicated RPC:
   * const { data: jobs } = await supabase.rpc('search_nearby_jobs', {
   *   _lat: -1.9536,
   *   _lng: 30.0606,
   *   _radius_km: 15,
   * });
   * 
   * // This method is for simple queries:
   * const result = await LocationService.findNearby<JobListing>(
   *   supabase,
   *   { lat: -1.9536, lng: 30.0606 },
   *   {
   *     tableName: 'jobs',
   *     limit: 10,
   *     filters: { status: 'active' },
   *   }
   * );
   * ```
   */
  static async findNearby<T = unknown>(
    supabase: SupabaseClient,
    coords: { lat: number; lng: number },
    options: {
      tableName: string;
      radiusMeters?: number;
      limit?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<NearbyResult<T>> {
    const {
      tableName,
      radiusMeters = DEFAULT_SEARCH_RADIUS_METERS,
      limit = 20,
      filters = {},
    } = options;

    try {
      // Build simple query without spatial filtering
      // For geospatial queries, use dedicated RPC functions with PostGIS
      let query = supabase
        .from(tableName)
        .select('*')
        .limit(limit);

      // Apply additional filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query;

      if (error) {
        console.error('[LocationService] Find nearby failed:', error);
        return {
          items: [],
          searchCenter: coords,
          radiusMeters,
          totalFound: 0,
        };
      }

      return {
        items: (data as T[]) || [],
        searchCenter: coords,
        radiusMeters,
        totalFound: data?.length || 0,
      };
    } catch (error) {
      console.error('[LocationService] Find nearby error:', error);
      return {
        items: [],
        searchCenter: coords,
        radiusMeters,
        totalFound: 0,
      };
    }
  }

  /**
   * Get the most recent location regardless of TTL
   * Useful for "Use Last Location" button
   * 
   * @param supabase Supabase client
   * @param userId User's profile ID
   * @param source Optional source filter
   */
  static async getLastLocation(
    supabase: SupabaseClient,
    userId: string,
    source?: string,
  ): Promise<RecentLocation | null> {
    try {
      let query = supabase
        .from('recent_locations')
        .select('*')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .limit(1);

      if (source) {
        query = query.eq('source', source);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0] as RecentLocation;
    } catch (error) {
      console.error('[LocationService] Get last location error:', error);
      return null;
    }
  }
}
