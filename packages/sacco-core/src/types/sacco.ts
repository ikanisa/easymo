import { z } from "zod";

export const SaccoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  district: z.string(),
  sector: z.string().optional(),
  sector_code: z.string(),
  merchant_code: z.string().optional(),
  province: z.string().optional(),
  email: z.string().email().optional(),
  category: z.string().optional(),
  logo_url: z.string().url().optional(),
  brand_color: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Sacco = z.infer<typeof SaccoSchema>;
export type SaccoStatus = Sacco["status"];
export type SaccoCategory = "Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)" | "Savings and Credit Cooperative";
