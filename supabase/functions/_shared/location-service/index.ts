/**
 * Unified Location Service
 * 
 * Canonical interface for all location operations across EasyMO.
 * Consolidates: saved_locations (favorites) + recent_locations (cache)
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface SavedLocation extends Location {
  id: string;
  user_id: string;
  kind: "home" | "work" | "school" | "other";
  label?: string;
  created_at: string;
  updated_at: string;
}

export interface RecentLocation extends Location {
  id: string;
  user_id: string;
  source: string;
  context?: string;
  expires_at: string;
  created_at: string;
}

export type LocationKind = SavedLocation["kind"];

// ═══════════════════════════════════════════════════════════════════════════
// Favorites (Persistent)
// ═══════════════════════════════════════════════════════════════════════════

export async function saveFavoriteLocation(
  supabase: SupabaseClient,
  userId: string,
  location: Location,
  kind: LocationKind,
  label?: string
): Promise<SavedLocation | null> {
  const { data, error } = await supabase.rpc("save_favorite_location", {
    p_user_id: userId,
    p_lat: location.lat,
    p_lng: location.lng,
    p_address: location.address || null,
    p_kind: kind,
    p_label: label || null,
  });

  if (error) {
    console.error("[LocationService] saveFavoriteLocation error:", error);
    return null;
  }

  return data?.[0] || null;
}

export async function getFavoriteLocation(
  supabase: SupabaseClient,
  userId: string,
  kind: LocationKind
): Promise<SavedLocation | null> {
  const { data, error } = await supabase.rpc("get_saved_location", {
    p_user_id: userId,
    p_kind: kind,
  });

  if (error) {
    console.error("[LocationService] getFavoriteLocation error:", error);
    return null;
  }

  return data?.[0] || null;
}

export async function listFavoriteLocations(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedLocation[]> {
  const { data, error } = await supabase.rpc("list_saved_locations", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[LocationService] listFavoriteLocations error:", error);
    return [];
  }

  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// Recent/Cache (TTL-based)
// ═══════════════════════════════════════════════════════════════════════════

export async function cacheLocation(
  supabase: SupabaseClient,
  userId: string,
  location: Location,
  source: string = "whatsapp",
  context?: string,
  ttlHours: number = 24
): Promise<RecentLocation | null> {
  const { data, error } = await supabase.rpc("save_recent_location", {
    p_user_id: userId,
    p_lat: location.lat,
    p_lng: location.lng,
    p_address: location.address || null,
    p_source: source,
    p_context: context || null,
    p_ttl_hours: ttlHours,
  });

  if (error) {
    console.error("[LocationService] cacheLocation error:", error);
    return null;
  }

  return data?.[0] || null;
}

export async function getCachedLocation(
  supabase: SupabaseClient,
  userId: string
): Promise<RecentLocation | null> {
  const { data, error } = await supabase.rpc("get_recent_location", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[LocationService] getCachedLocation error:", error);
    return null;
  }

  return data?.[0] || null;
}

export async function hasCachedLocation(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_recent_location", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[LocationService] hasCachedLocation error:", error);
    return false;
  }

  return data === true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Smart Location Resolution (Favorites > Cache > Prompt)
// ═══════════════════════════════════════════════════════════════════════════

export interface ResolvedLocation {
  location: Location;
  source: "favorite" | "cache" | "none";
  favoriteKind?: LocationKind;
}

export async function resolveUserLocation(
  supabase: SupabaseClient,
  userId: string,
  preferredKind?: LocationKind
): Promise<ResolvedLocation | null> {
  // 1. Try preferred favorite first
  if (preferredKind) {
    const favorite = await getFavoriteLocation(supabase, userId, preferredKind);
    if (favorite) {
      return {
        location: { lat: favorite.lat, lng: favorite.lng, address: favorite.address },
        source: "favorite",
        favoriteKind: preferredKind,
      };
    }
  }

  // 2. Try home as default favorite
  if (preferredKind !== "home") {
    const home = await getFavoriteLocation(supabase, userId, "home");
    if (home) {
      return {
        location: { lat: home.lat, lng: home.lng, address: home.address },
        source: "favorite",
        favoriteKind: "home",
      };
    }
  }

  // 3. Try recent cache
  const cached = await getCachedLocation(supabase, userId);
  if (cached) {
    return {
      location: { lat: cached.lat, lng: cached.lng, address: cached.address },
      source: "cache",
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced Cache Functions (Using New RPC Functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cache location using standardized RPC function
 * Supports context-specific caching for all domains
 */
export async function cacheLocationWithContext(
  supabase: SupabaseClient,
  userId: string,
  location: Location,
  options: {
    context?: 'mobility' | 'jobs' | 'real_estate' | 'marketplace' | 'general';
    source?: string;
    ttlHours?: number;
  } = {}
): Promise<string> {
  const { data, error } = await supabase.rpc('cache_user_location', {
    p_user_id: userId,
    p_lat: location.lat,
    p_lng: location.lng,
    p_address: location.address ?? null,
    p_source: options.source ?? 'user_input',
    p_context: options.context ?? 'general',
    p_ttl_hours: options.ttlHours ?? 24,
  });

  if (error) {
    throw new Error(`Failed to cache location: ${error.message}`);
  }

  return data;
}

/**
 * Get cached location for specific context using RPC
 */
export async function getCachedLocationByContext(
  supabase: SupabaseClient,
  userId: string,
  context: string = 'general',
  maxAgeMinutes: number = 60
): Promise<RecentLocation | null> {
  const { data, error } = await supabase.rpc('get_recent_location', {
    p_user_id: userId,
    p_context: context,
    p_max_age_minutes: maxAgeMinutes,
  });

  if (error) {
    throw new Error(`Failed to get cached location: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    id: '', // RPC doesn't return ID
    user_id: userId,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    source: row.source,
    context,
    expires_at: new Date(Date.now() + maxAgeMinutes * 60 * 1000).toISOString(),
    created_at: row.cached_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Universal Proximity Search
// ═══════════════════════════════════════════════════════════════════════════

export interface ProximitySearchResult<T = any> {
  item: T;
  distance_km: number;
}

/**
 * Universal proximity search using standardized RPC
 * Works with any table that has location columns
 */
export async function searchNearbyItems<T = any>(
  supabase: SupabaseClient,
  params: {
    tableName: string;
    lat: number;
    lng: number;
    radiusKm?: number;
    limit?: number;
    whereClause?: string;
  }
): Promise<Array<ProximitySearchResult<T>>> {
  const { data, error } = await supabase.rpc('find_nearby_items', {
    p_table_name: params.tableName,
    p_lat: params.lat,
    p_lng: params.lng,
    p_radius_km: params.radiusKm ?? 10,
    p_limit: params.limit ?? 20,
    p_where_clause: params.whereClause ?? null,
  });

  if (error) {
    throw new Error(`Proximity search failed: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    item: row.item_data as T,
    distance_km: row.distance_km,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Domain-Specific Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mobility domain location helpers
 */
export const MobilityLocation = {
  cacheDriverLocation: async (
    supabase: SupabaseClient,
    userId: string,
    location: Location
  ) => {
    return cacheLocationWithContext(supabase, userId, location, {
      context: 'mobility',
      source: 'gps',
      ttlHours: 2, // Shorter TTL for driver locations
    });
  },

  getCachedDriverLocation: async (
    supabase: SupabaseClient,
    userId: string
  ) => {
    return getCachedLocationByContext(supabase, userId, 'mobility', 120); // 2 hours
  },
};

/**
 * Jobs domain location helpers
 */
export const JobsLocation = {
  cacheSearchLocation: async (
    supabase: SupabaseClient,
    userId: string,
    location: Location
  ) => {
    return cacheLocationWithContext(supabase, userId, location, {
      context: 'jobs',
      ttlHours: 168, // 7 days
    });
  },

  searchNearbyJobs: async (
    supabase: SupabaseClient,
    lat: number,
    lng: number,
    radiusKm: number = 50
  ) => {
    return searchNearbyItems(supabase, {
      tableName: 'job_listings',
      lat,
      lng,
      radiusKm,
      whereClause: "status = 'active'",
    });
  },
};

/**
 * Real Estate domain location helpers
 */
export const RealEstateLocation = {
  cacheSearchLocation: async (
    supabase: SupabaseClient,
    userId: string,
    location: Location
  ) => {
    return cacheLocationWithContext(supabase, userId, location, {
      context: 'real_estate',
      ttlHours: 168, // 7 days
    });
  },

  searchNearbyProperties: async (
    supabase: SupabaseClient,
    params: {
      lat: number;
      lng: number;
      radiusKm?: number;
      priceMin?: number;
      priceMax?: number;
      bedrooms?: number;
      propertyType?: string;
      listingType?: string;
    }
  ) => {
    const { data, error } = await supabase.rpc('search_properties_unified_v2', {
      p_lat: params.lat,
      p_lng: params.lng,
      p_radius_km: params.radiusKm ?? 10,
      p_price_min: params.priceMin ?? null,
      p_price_max: params.priceMax ?? null,
      p_bedrooms: params.bedrooms ?? null,
      p_property_type: params.propertyType ?? null,
      p_listing_type: params.listingType ?? null,
    });

    if (error) {
      throw new Error(`Property search failed: ${error.message}`);
    }

    return data;
  },
};

/**
 * Marketplace domain location helpers
 */
export const MarketplaceLocation = {
  cacheSearchLocation: async (
    supabase: SupabaseClient,
    userId: string,
    location: Location
  ) => {
    return cacheLocationWithContext(supabase, userId, location, {
      context: 'marketplace',
      ttlHours: 24,
    });
  },

  searchNearbyBusinesses: async (
    supabase: SupabaseClient,
    query: string,
    lat: number,
    lng: number,
    radiusKm: number = 10
  ) => {
    const { data, error } = await supabase.rpc('search_businesses_ai', {
      p_query: query,
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
    });

    if (error) {
      throw new Error(`Business search failed: ${error.message}`);
    }

    return data;
  },
};
