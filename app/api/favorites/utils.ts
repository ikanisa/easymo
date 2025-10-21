import { z } from 'zod';
import type { Coordinates } from '../_lib/locations';
import { parseGeography, toGeographyPoint } from '../_lib/locations';

export const favoriteKinds = ['home', 'work', 'school', 'other'] as const;

export const favoritePayloadSchema = z.object({
  kind: z.enum(favoriteKinds),
  label: z.string().min(1).max(120),
  address: z.string().min(1).max(240).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  is_default: z.boolean().optional(),
});

export const favoriteUpdateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(120).optional(),
  address: z.string().max(240).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  is_default: z.boolean().optional(),
});

export type FavoriteInsertPayload = z.infer<typeof favoritePayloadSchema>;
export type FavoriteUpdatePayload = z.infer<typeof favoriteUpdateSchema>;

export function buildFavoriteInsert(userId: string, payload: FavoriteInsertPayload) {
  return {
    user_id: userId,
    kind: payload.kind,
    label: payload.label,
    address: payload.address ?? null,
    geog: toGeographyPoint(payload.lng, payload.lat),
    is_default: payload.is_default ?? false,
  };
}

export function buildFavoriteUpdate(payload: FavoriteUpdatePayload) {
  const update: Record<string, unknown> = {};
  if (typeof payload.label === 'string') {
    update.label = payload.label;
  }
  if ('address' in payload) {
    update.address = payload.address ?? null;
  }
  if (payload.lat !== undefined && payload.lng !== undefined) {
    update.geog = toGeographyPoint(payload.lng, payload.lat);
  }
  if (payload.is_default !== undefined) {
    update.is_default = payload.is_default;
  }
  return update;
}

export function mapFavoriteRow(row: {
  id: string;
  user_id?: string;
  kind: string;
  label: string;
  address: string | null;
  geog: unknown;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}): {
  id: string;
  kind: string;
  label: string;
  address: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  coordinates: Coordinates | null;
} {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    address: row.address,
    is_default: row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
    coordinates: parseGeography(row.geog as any),
  };
}

export function needsUnsetDefault(payload: FavoriteInsertPayload | FavoriteUpdatePayload): payload is (FavoriteInsertPayload & { is_default: true }) | (FavoriteUpdatePayload & { is_default: true }) {
  return payload.is_default === true;
}
