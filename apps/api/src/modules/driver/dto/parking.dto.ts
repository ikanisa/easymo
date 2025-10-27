import { z } from 'zod';

export const CreateParkingDtoSchema = z.object({
  label: z.string().min(1).max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  active: z.boolean().optional().default(true),
});

export const UpdateParkingDtoSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  active: z.boolean().optional(),
});

export type CreateParkingDto = z.infer<typeof CreateParkingDtoSchema>;
export type UpdateParkingDto = z.infer<typeof UpdateParkingDtoSchema>;
