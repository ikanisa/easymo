<<<<<<< HEAD
import { z } from 'zod';

export const SaccoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
=======
import { z } from "zod";

export const SaccoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
>>>>>>> feature/location-caching-and-mobility-deep-review
  district: z.string(),
  sector: z.string().optional(),
  sector_code: z.string(),
  merchant_code: z.string().optional(),
  province: z.string().optional(),
  email: z.string().email().optional(),
<<<<<<< HEAD
  category: z.string().default('Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)'),
  logo_url: z.string().url().optional(),
  brand_color: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  metadata: z.record(z.unknown()).default({}),
=======
  category: z.string().optional(),
  logo_url: z.string().url().optional(),
  brand_color: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  metadata: z.record(z.unknown()).optional(),
>>>>>>> feature/location-caching-and-mobility-deep-review
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Sacco = z.infer<typeof SaccoSchema>;
<<<<<<< HEAD

export const CreateSaccoSchema = SaccoSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateSacco = z.infer<typeof CreateSaccoSchema>;

export const UpdateSaccoSchema = CreateSaccoSchema.partial();

export type UpdateSacco = z.infer<typeof UpdateSaccoSchema>;
=======
export type SaccoStatus = Sacco["status"];
export type SaccoCategory = "Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)" | "Savings and Credit Cooperative";
>>>>>>> feature/location-caching-and-mobility-deep-review
