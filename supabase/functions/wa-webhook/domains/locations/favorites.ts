import type { RouterContext } from "../../types.ts";

export type FavoriteKind = "home" | "work" | "school" | "other";

export type UserFavorite = {
  id: string;
  kind: FavoriteKind;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
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
    .select("id, label, address, lat, lng")
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
    .select("id, label, address, lat, lng")
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
  options: { label?: string; address?: string | null } = {},
): Promise<UserFavorite | null> {
  if (!ctx.profileId) return null;
  const normalizedLabel = options.label?.trim() || favoriteKindLabel(kind);

  // First check if a location with this label already exists for this user
  const { data: existing } = await ctx.supabase
    .from("saved_locations")
    .select("id")
    .eq("user_id", ctx.profileId)
    .eq("label", normalizedLabel)
    .maybeSingle();

  if (existing) {
    // Update existing favorite
    const updated = await updateFavorite(ctx, existing.id, coords, {
      label: normalizedLabel,
      address: options.address,
    });
    if (!updated) return null;
    return getFavoriteById(ctx, existing.id);
  }

  // Insert new favorite
  const payload = {
    user_id: ctx.profileId,
    label: normalizedLabel,
    address: options.address ?? null,
    lat: coords.lat,
    lng: coords.lng,
  };

  const { data, error } = await ctx.supabase
    .from("saved_locations")
    .insert(payload)
    .select("id, label, address, lat, lng")
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

// Normalize saved_locations rows (has lat/lng directly)
type SavedLocationRow = {
  id: string;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
};

function normalizeSavedLocations(rows: SavedLocationRow[]): UserFavorite[] {
  const favorites: UserFavorite[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    // Infer kind from label
    const label = row.label || "Other";
    const labelLower = label.toLowerCase();
    let kind: FavoriteKind = "other";
    if (labelLower === "home" || labelLower === "🏠 home") kind = "home";
    else if (labelLower === "work" || labelLower === "💼 work") kind = "work";
    else if (labelLower === "school" || labelLower === "🎓 school") {
      kind = "school";
    }

    favorites.push({
      id: row.id,
      kind,
      label,
      address: row.address ?? null,
      lat: row.lat,
      lng: row.lng,
    });
  }
  return favorites;
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
): Promise<{ lat: number; lng: number } | null> {
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
      return { lat: last.lat, lng: last.lng };
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
