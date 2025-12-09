import { z } from 'zod';

export const MemberSchema = z.object({
  id: z.string().uuid(),
  ikimina_id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  member_code: z.string().optional(),
  full_name: z.string(),
  national_id: z.string().optional(),
  national_id_encrypted: z.string().optional(),
  national_id_hash: z.string().optional(),
  national_id_masked: z.string().optional(),
  msisdn: z.string(),
  msisdn_encrypted: z.string().optional(),
  msisdn_hash: z.string().optional(),
  msisdn_masked: z.string().optional(),
  joined_at: z.string().datetime(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Member = z.infer<typeof MemberSchema>;

export const CreateMemberSchema = MemberSchema.omit({
  id: true,
  national_id_encrypted: true,
  national_id_hash: true,
  national_id_masked: true,
  msisdn_encrypted: true,
  msisdn_hash: true,
  msisdn_masked: true,
  created_at: true,
  updated_at: true,
});

export type CreateMember = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = CreateMemberSchema.partial();

export type UpdateMember = z.infer<typeof UpdateMemberSchema>;
