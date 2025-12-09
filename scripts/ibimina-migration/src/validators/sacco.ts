import { z } from "zod";

export const saccoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  district: z.string().min(1),
  sector_code: z.string().min(1),
  status: z.string().optional(),
});

export function validateSacco(data: unknown): boolean {
  const result = saccoSchema.safeParse(data);
  return result.success;
}
