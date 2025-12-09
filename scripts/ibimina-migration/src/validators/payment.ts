import { z } from "zod";

export const paymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number(),
});

export function validatePayment(data: unknown): boolean {
  const result = paymentSchema.safeParse(data);
  return result.success;
}
