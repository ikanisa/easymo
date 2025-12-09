import { z } from "zod";

export const AccountSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid().optional(),
  ikimina_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  account_type: z.string(),
  balance: z.number().default(0),
  currency: z.string().default("RWF"),
  status: z.enum(["ACTIVE", "INACTIVE", "FROZEN"]).default("ACTIVE"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountType = "SAVINGS" | "SHARES" | "LOAN" | "EMERGENCY_FUND";
export type AccountStatus = Account["status"];
