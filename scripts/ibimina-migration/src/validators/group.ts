import { z } from "zod";

export const groupSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
});

export function validateGroup(data: unknown): boolean {
  const result = groupSchema.safeParse(data);
  return result.success;
}
