import type { SupabaseClient } from "../../deps.ts";

export type NearbyIntentMode = "drivers" | "passengers";

export type NearbyIntentSnapshot = {
  vehicle: string;
  lat: number;
  lng: number;
  capturedAt: string;
};

// Intent cache TTL: configurable via environment variable, default 10 minutes
const DEFAULT_INTENT_TTL_MINUTES = 10;
const envTtlMinutes = Number(Deno.env.get("MOBILITY_INTENT_TTL_MINUTES"));
const INTENT_TTL_MINUTES = Number.isFinite(envTtlMinutes) && envTtlMinutes > 0 
  ? envTtlMinutes 
  : DEFAULT_INTENT_TTL_MINUTES;
const INTENT_TTL_MS = INTENT_TTL_MINUTES * 60 * 1000;

type MetadataRecord = Record<string, unknown>;

type NearbyMap = Partial<Record<NearbyIntentMode, NearbyIntentSnapshot>>;

type ProfilesRow = {
  metadata?: unknown;
};

function isRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneMetadata<T extends MetadataRecord>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseSnapshot(value: unknown): NearbyIntentSnapshot | null {
  if (!isRecord(value)) return null;
  const vehicle = typeof value.vehicle === "string"
    ? value.vehicle.trim().toLowerCase()
    : null;
  const lat = typeof value.lat === "number" ? value.lat : Number(value.lat);
  const lng = typeof value.lng === "number" ? value.lng : Number(value.lng);
  const capturedAt = typeof value.capturedAt === "string"
    ? value.capturedAt
    : null;

  if (
    !vehicle || !Number.isFinite(lat) || !Number.isFinite(lng) || !capturedAt
  ) {
    return null;
  }
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) return null;
  return {
    vehicle,
    lat,
    lng,
    capturedAt: new Date(capturedMs).toISOString(),
  };
}

async function loadMetadata(
  client: SupabaseClient,
  profileId: string,
): Promise<MetadataRecord> {
  const { data, error } = await client
    .from("profiles")
    .select("metadata")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  const row = (data ?? {}) as ProfilesRow;
  if (!row.metadata || !isRecord(row.metadata)) return {};
  return row.metadata as MetadataRecord;
}

function ensureMobilityMetadata(
  metadata: MetadataRecord,
): { root: MetadataRecord; mobility: MetadataRecord; nearby: NearbyMap } {
  const root = cloneMetadata(metadata);
  const mobilityRaw = isRecord(root.mobility) ? root.mobility : {};
  const mobility = cloneMetadata(mobilityRaw as MetadataRecord);
  const nearbyRaw = mobility.nearby;
  const nearby = isRecord(nearbyRaw)
    ? cloneMetadata(nearbyRaw as MetadataRecord) as NearbyMap
    : {} as NearbyMap;
  mobility.nearby = nearby;
  root.mobility = mobility;
  return { root, mobility, nearby };
}

export async function getRecentNearbyIntent(
  client: SupabaseClient,
  profileId: string,
  mode: NearbyIntentMode,
  now = Date.now(),
): Promise<NearbyIntentSnapshot | null> {
  const metadata = await loadMetadata(client, profileId);
  const mobilityRaw = isRecord(metadata.mobility) ? metadata.mobility : null;
  const nearbyRaw = mobilityRaw && isRecord(mobilityRaw.nearby)
    ? mobilityRaw.nearby
    : null;
  const snapshotRaw = nearbyRaw && snapshotForMode(nearbyRaw, mode);
  const snapshot = parseSnapshot(snapshotRaw);
  if (!snapshot) return null;
  const capturedMs = Date.parse(snapshot.capturedAt);
  if (!Number.isFinite(capturedMs)) return null;
  if (now - capturedMs > INTENT_TTL_MS) return null;
  return snapshot;
}

function snapshotForMode(
  nearby: unknown,
  mode: NearbyIntentMode,
): unknown {
  if (!isRecord(nearby)) return null;
  return nearby[mode];
}

export async function storeNearbyIntent(
  client: SupabaseClient,
  profileId: string,
  mode: NearbyIntentMode,
  payload: { vehicle: string; lat: number; lng: number },
  capturedAt = new Date().toISOString(),
): Promise<void> {
  const vehicle = payload.vehicle.trim().toLowerCase();
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  if (!vehicle || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid intent payload");
  }
  const metadata = await loadMetadata(client, profileId);
  const { root, mobility, nearby } = ensureMobilityMetadata(metadata);
  nearby[mode] = {
    vehicle,
    lat,
    lng,
    capturedAt: new Date(capturedAt).toISOString(),
  };
  mobility.nearby = nearby;
  const { error } = await client
    .from("profiles")
    .update({ metadata: root })
    .eq("user_id", profileId);
  if (error) throw error;
}

export function getIntentTtlMs(): number {
  return INTENT_TTL_MS;
}
