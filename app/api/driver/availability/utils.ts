import { z } from 'zod';

export const daysOfWeekSchema = z.array(z.number().int().min(1).max(7)).min(1).max(7);

export const availabilityCreateSchema = z.object({
  parking_id: z.string().uuid().nullable().optional(),
  days_of_week: daysOfWeekSchema,
  start_time_local: z.string().regex(/^\d{2}:\d{2}$/),
  end_time_local: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(2).max(60).optional(),
  active: z.boolean().optional(),
});

export const availabilityUpdateSchema = z.object({
  id: z.string().uuid(),
  parking_id: z.string().uuid().nullable().optional(),
  days_of_week: daysOfWeekSchema.optional(),
  start_time_local: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time_local: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().min(2).max(60).optional(),
  active: z.boolean().optional(),
});

export function buildAvailabilityInsert(driverId: string, payload: z.infer<typeof availabilityCreateSchema>) {
  return {
    driver_id: driverId,
    parking_id: payload.parking_id ?? null,
    days_of_week: payload.days_of_week,
    start_time_local: payload.start_time_local,
    end_time_local: payload.end_time_local,
    timezone: payload.timezone ?? 'Africa/Kigali',
    active: payload.active ?? true,
  };
}

export function buildAvailabilityUpdate(payload: z.infer<typeof availabilityUpdateSchema>) {
  const update: Record<string, unknown> = {};
  if (payload.parking_id !== undefined) {
    update.parking_id = payload.parking_id ?? null;
  }
  if (payload.days_of_week) {
    update.days_of_week = payload.days_of_week;
  }
  if (payload.start_time_local) {
    update.start_time_local = payload.start_time_local;
  }
  if (payload.end_time_local) {
    update.end_time_local = payload.end_time_local;
  }
  if (payload.timezone) {
    update.timezone = payload.timezone;
  }
  if (payload.active !== undefined) {
    update.active = payload.active;
  }
  return update;
}

export function mapAvailabilityRow(row: {
  id: string;
  driver_id: string;
  parking_id: string | null;
  days_of_week: number[];
  start_time_local: string;
  end_time_local: string;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    driver_id: row.driver_id,
    parking_id: row.parking_id,
    days_of_week: row.days_of_week,
    start_time_local: row.start_time_local,
    end_time_local: row.end_time_local,
    timezone: row.timezone,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
