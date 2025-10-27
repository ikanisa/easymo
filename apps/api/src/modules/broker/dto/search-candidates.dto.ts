import { z } from 'zod';

export const SearchCandidatesDtoSchema = z.object({
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  dropoff_lat: z.number().min(-90).max(90).optional(),
  dropoff_lng: z.number().min(-180).max(180).optional(),
  radius_km: z.number().positive().optional().default(10),
  when: z.string().datetime().optional(),
  limit: z.number().int().positive().max(200).optional().default(20),
});

export type SearchCandidatesDto = z.infer<typeof SearchCandidatesDtoSchema>;
