import { z } from "zod";

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid().optional(),
  ikimina_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().default("RWF"),
  payment_method: z.string().optional(),
  reference: z.string().optional(),
  status: z.enum(["matched", "unmatched", "pending", "failed"]).default("unmatched"),
  confidence: z.number().min(0).max(1).optional(),
  sms_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  processed_at: z.string().datetime().optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentStatus = Payment["status"];
export type PaymentMethod = "MoMo" | "Airtel Money" | "Cash" | "Bank Transfer";
