import { z } from 'zod';

export const recurringTripBaseSchema = {
  origin_favorite_id: z.string().uuid(),
  dest_favorite_id: z.string().uuid(),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  time_local: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(2).max(60).optional(),
  radius_km: z.number().positive().max(100).optional(),
  active: z.boolean().optional(),
};

export const recurringTripCreateSchema = z.object(recurringTripBaseSchema);

export const recurringTripUpdateSchema = z.object({
  id: z.string().uuid(),
  origin_favorite_id: z.string().uuid().optional(),
  dest_favorite_id: z.string().uuid().optional(),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  time_local: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().min(2).max(60).optional(),
  radius_km: z.number().positive().max(100).optional(),
  active: z.boolean().optional(),
});

export function buildRecurringTripInsert(userId: string, payload: z.infer<typeof recurringTripCreateSchema>) {
  return {
    user_id: userId,
    origin_favorite_id: payload.origin_favorite_id,
    dest_favorite_id: payload.dest_favorite_id,
    days_of_week: payload.days_of_week,
    time_local: payload.time_local,
    timezone: payload.timezone ?? 'Africa/Kigali',
    radius_km: payload.radius_km ?? 10,
    active: payload.active ?? true,
  };
}

export function buildRecurringTripUpdate(payload: z.infer<typeof recurringTripUpdateSchema>) {
  const update: Record<string, unknown> = {};
  if (payload.origin_favorite_id) {
    update.origin_favorite_id = payload.origin_favorite_id;
  }
  if (payload.dest_favorite_id) {
    update.dest_favorite_id = payload.dest_favorite_id;
  }
  if (payload.days_of_week) {
    update.days_of_week = payload.days_of_week;
  }
  if (payload.time_local) {
    update.time_local = payload.time_local;
  }
  if (payload.timezone) {
    update.timezone = payload.timezone;
  }
  if (payload.radius_km !== undefined) {
    update.radius_km = payload.radius_km;
  }
  if (payload.active !== undefined) {
    update.active = payload.active;
  }
  return update;
}
