import type { RouterContext } from "../types.ts";
import { checkDuplicateLocation } from "../../_shared/wa-webhook-shared/locations/deduplication.ts";
import { getAddressOrCoords } from "../../_shared/wa-webhook-shared/locations/geocoding.ts";

export type FavoriteKind = "home" | "work" | "school" | "other";

export type UserFavorite = {
  id: string;
  kind: FavoriteKind;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
};

type RawFavorite = {
  id: string;
  kind: FavoriteKind;
  label: string;
  address?: string | null;
  geog?: string | Record<string, unknown>;
};

const FAVORITE_LABELS: Record<FavoriteKind, string> = {
  home: "Home",
  work: "Work",
  school: "School",
  other: "Other",
};

export const FAVORITE_KINDS: FavoriteKind[] = [
  "home",
  "work",
  "school",
  "other",
];

export function favoriteKindLabel(kind: FavoriteKind): string {
  return FAVORITE_LABELS[kind] ?? kind;
}

export async function listFavorites(
  ctx: RouterContext,
): Promise<UserFavorite[]> {
  if (!ctx.profileId) return [];
  const { data, error } = await ctx.supabase
    .from("saved_locations")
    .select("id, kind, label, address, lat, lng")
    .eq("user_id", ctx.profileId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("locations.favorites_list_fail", error);
    return [];
  }
  return normalizeSavedLocations(data ?? []);
}

export async function getFavoriteById(
  ctx: RouterContext,
  id: string,
): Promise<UserFavorite | null> {
  if (!ctx.profileId) return null;
  const { data, error } = await ctx.supabase
    .from("saved_locations")
    .select("id, kind, label, address, lat, lng")
    .eq("user_id", ctx.profileId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("locations.favorite_lookup_fail", error, { id });
    return null;
  }
  const favorites = normalizeSavedLocations(data ? [data] : []);
  return favorites[0] ?? null;
}

export async function saveFavorite(
  ctx: RouterContext,
  kind: FavoriteKind,
  coords: { lat: number; lng: number },
  options: { label?: string; address?: string | null; skipDedup?: boolean } = {},
): Promise<UserFavorite | null> {
  if (!ctx.profileId) return null;
  const normalizedLabel = options.label?.trim() || favoriteKindLabel(kind);
  
  // Phase 2.1: Auto-geocode if no address provided
  let finalAddress = options.address;
  if (!finalAddress) {
    try {
      finalAddress = await getAddressOrCoords(coords.lat, coords.lng);
      console.log("location.geocoded", { lat: coords.lat, lng: coords.lng, address: finalAddress });
    } catch (error) {
      console.warn("location.geocode_fail", error);
      finalAddress = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
  }

  // Phase 2.2: Check for duplicates (skip if explicitly requested)
  if (!options.skipDedup) {
    const dupCheck = await checkDuplicateLocation(
      ctx.supabase,
      ctx.profileId,
      coords,
      50, // 50m radius
    );
    
    if (dupCheck.isDuplicate && dupCheck.nearbyLocations.length > 0) {
      const closest = dupCheck.nearbyLocations[0];
      console.log("location.duplicate_detected", {
        newLabel: normalizedLabel,
        existingLabel: closest.label,
        distance: closest.distance,
      });
      // Return the existing location instead of creating duplicate
      return getFavoriteById(ctx, closest.id);
    }
  }
  
  // Check if a location with this kind already exists for this user
  const { data: existing } = await ctx.supabase
    .from("saved_locations")
    .select("id")
    .eq("user_id", ctx.profileId)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) {
    // Update existing favorite of same kind
    const updated = await updateFavorite(ctx, existing.id, coords, {
      label: normalizedLabel,
      address: finalAddress,
    });
    if (!updated) return null;
    return getFavoriteById(ctx, existing.id);
  }

  // Insert new favorite
  const payload = {
    user_id: ctx.profileId,
    kind,
    label: normalizedLabel,
    address: finalAddress,
    lat: coords.lat,
    lng: coords.lng,
  };

  const { data, error } = await ctx.supabase
    .from("saved_locations")
    .insert(payload)
    .select("id, kind, label, address, lat, lng")
    .single();
  if (error) {
    console.error("locations.favorite_save_fail", error);
    return null;
  }
  const favorites = normalizeSavedLocations(data ? [data] : []);
  return favorites[0] ?? null;
}

export async function updateFavorite(
  ctx: RouterContext,
  favoriteId: string,
  coords: { lat: number; lng: number },
  options: { label?: string; address?: string | null } = {},
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const payload: Record<string, unknown> = {
    lat: coords.lat,
    lng: coords.lng,
  };
  if (options.label) payload.label = options.label;
  if (options.address !== undefined) payload.address = options.address;

  const { error } = await ctx.supabase
    .from("saved_locations")
    .update(payload)
    .eq("user_id", ctx.profileId)
    .eq("id", favoriteId);
  if (error) {
    console.error("locations.favorite_update_fail", error);
    return false;
  }
  return true;
}

function normalizeFavorites(rows: RawFavorite[]): UserFavorite[] {
  const favorites: UserFavorite[] = [];
  for (const row of rows) {
    const coords = parsePoint(row.geog);
    if (!coords) continue;
    favorites.push({
      id: row.id,
      kind: row.kind,
      label: row.label,
      address: row.address ?? null,
      lat: coords.lat,
      lng: coords.lng,
    });
  }
  return favorites;
}

// Normalize saved_locations rows (has lat/lng directly, not geog)
type SavedLocationRow = {
  id: string;
  kind: FavoriteKind;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
};

function normalizeSavedLocations(rows: SavedLocationRow[]): UserFavorite[] {
  const favorites: UserFavorite[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    
    favorites.push({
      id: row.id,
      kind: row.kind || 'other',
      label: row.label,
      address: row.address ?? null,
      lat: row.lat,
      lng: row.lng,
    });
  }
  return favorites;
}

function parsePoint(
  value: string | Record<string, unknown> | undefined,
): { lat: number; lng: number } | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/POINT\\(([-0-9.]+) ([-0-9.]+)\\)/i);
    if (match) {
      const [, lngRaw, latRaw] = match;
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }
  if (
    typeof value === "object" && value && "coordinates" in value &&
    Array.isArray((value as { coordinates: number[] }).coordinates)
  ) {
    const coords = (value as { coordinates: number[] }).coordinates;
    if (coords.length === 2) {
      const [lng, lat] = coords;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
}

export async function recordLastLocation(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
): Promise<void> {
  if (!ctx.profileId) return;
  try {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("metadata")
      .eq("user_id", ctx.profileId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    const metadata = (data?.metadata && isRecord(data.metadata))
      ? { ...data.metadata }
      : {};
    const mobilityMeta = isRecord(metadata.mobility)
      ? { ...metadata.mobility }
      : {};
    mobilityMeta.last_location = {
      lat: coords.lat,
      lng: coords.lng,
      capturedAt: new Date().toISOString(),
    };
    metadata.mobility = mobilityMeta;
    const { error: updateError } = await ctx.supabase
      .from("profiles")
      .update({ metadata })
      .eq("user_id", ctx.profileId);
    if (updateError) throw updateError;
  } catch (err) {
    console.error("locations.record_last_fail", err);
  }
}

export async function readLastLocation(
  ctx: RouterContext,
): Promise<{ lat: number; lng: number; capturedAt?: string } | null> {
  if (!ctx.profileId) return null;
  try {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("metadata")
      .eq("user_id", ctx.profileId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    const entry = data?.metadata;
    if (!isRecord(entry)) return null;
    const mobility = isRecord(entry.mobility) ? entry.mobility : null;
    const last = mobility && isRecord(mobility.last_location)
      ? mobility.last_location
      : null;
    if (
      last &&
      typeof last.lat === "number" &&
      typeof last.lng === "number"
    ) {
      return { 
        lat: last.lat, 
        lng: last.lng,
        capturedAt: typeof last.capturedAt === "string" ? last.capturedAt : undefined
      };
    }
  } catch (err) {
    console.error("locations.read_last_fail", err);
  }
  return null;
}
type MetadataRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
