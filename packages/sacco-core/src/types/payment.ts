import { z } from 'zod';

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid().optional(),
  ikimina_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  amount: z.number().int().positive(),
  currency: z.string().default('RWF'),
  payment_method: z.string().optional(),
  reference: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('pending'),
  confidence: z.number().min(0).max(1).optional(),
  sms_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  processed_at: z.string().datetime().optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentStatus = Payment["status"];
export type PaymentMethod = "MoMo" | "Airtel Money" | "Cash" | "Bank Transfer";

export const CreatePaymentSchema = PaymentSchema.omit({
  id: true,
  created_at: true,
});

export type CreatePayment = z.infer<typeof CreatePaymentSchema>;

export const UpdatePaymentSchema = CreatePaymentSchema.partial();

export type UpdatePayment = z.infer<typeof UpdatePaymentSchema>;
