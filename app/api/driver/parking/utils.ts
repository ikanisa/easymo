import { z } from 'zod';
import { toGeographyPoint, parseGeography } from '../../_lib/locations';

export const parkingCreateSchema = z.object({
  label: z.string().min(1).max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  active: z.boolean().optional(),
});

export const parkingUpdateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(160).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  active: z.boolean().optional(),
});

export function buildParkingInsert(driverId: string, payload: z.infer<typeof parkingCreateSchema>) {
  return {
    driver_id: driverId,
    label: payload.label,
    geog: toGeographyPoint(payload.lng, payload.lat),
    active: payload.active ?? true,
  };
}

export function buildParkingUpdate(payload: z.infer<typeof parkingUpdateSchema>) {
  const update: Record<string, unknown> = {};
  if (typeof payload.label === 'string') {
    update.label = payload.label;
  }
  if (payload.lat !== undefined && payload.lng !== undefined) {
    update.geog = toGeographyPoint(payload.lng, payload.lat);
  }
  if (payload.active !== undefined) {
    update.active = payload.active;
  }
  return update;
}

export function mapParkingRow(row: {
  id: string;
  driver_id: string;
  label: string;
  geog: unknown;
  active: boolean;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    driver_id: row.driver_id,
    label: row.label,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    coordinates: parseGeography(row.geog as any),
  };
}
