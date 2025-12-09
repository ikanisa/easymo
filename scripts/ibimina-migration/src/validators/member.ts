import { z } from "zod";

export const memberSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  full_name: z.string().min(1),
  msisdn: z.string().min(1),
});

export function validateMember(data: unknown): boolean {
  const result = memberSchema.safeParse(data);
  return result.success;
}
