import { z } from "zod";

export const MemberSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  ikimina_id: z.string().uuid().optional(),
  member_code: z.string().optional(),
  full_name: z.string().min(1),
  msisdn_masked: z.string().optional(),
  msisdn_hash: z.string().optional(),
  national_id_masked: z.string().optional(),
  national_id_hash: z.string().optional(),
  joined_at: z.string().datetime(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Member = z.infer<typeof MemberSchema>;
export type MemberStatus = Member["status"];
