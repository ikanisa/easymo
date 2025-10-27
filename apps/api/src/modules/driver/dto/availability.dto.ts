import { z } from 'zod';

export const CreateAvailabilityDtoSchema = z.object({
  parking_id: z.string().uuid().optional().nullable(),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1),
  start_time_local: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
  end_time_local: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
  timezone: z.string().optional().default('Africa/Kigali'),
  active: z.boolean().optional().default(true),
});

export const UpdateAvailabilityDtoSchema = z.object({
  parking_id: z.string().uuid().optional().nullable(),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  start_time_local: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
  end_time_local: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
});

export type CreateAvailabilityDto = z.infer<typeof CreateAvailabilityDtoSchema>;
export type UpdateAvailabilityDto = z.infer<typeof UpdateAvailabilityDtoSchema>;
