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
// Deprecation Bridge (for migration period)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use cacheLocation() instead
 * Bridge for code still using whatsapp_users.location_cache
 */
export async function updateLegacyLocationCache(
  supabase: SupabaseClient,
  userId: string,
  location: Location
): Promise<void> {
  // Write to new system
  await cacheLocation(supabase, userId, location, "legacy_bridge");
  
  // Log deprecation warning
  console.warn(
    "[LocationService] updateLegacyLocationCache is deprecated. " +
    "Migrate to cacheLocation()"
  );
}
