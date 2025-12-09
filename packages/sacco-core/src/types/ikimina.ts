import { z } from 'zod';

export const IkiminaSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(['ASCA', 'VSLA', 'SILC', 'ROSCA']).default('ASCA'),
  settings_json: z.record(z.unknown()).default({}),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Ikimina = z.infer<typeof IkiminaSchema>;

export const CreateIkiminaSchema = IkiminaSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateIkimina = z.infer<typeof CreateIkiminaSchema>;

export const UpdateIkiminaSchema = CreateIkiminaSchema.partial();

export type UpdateIkimina = z.infer<typeof UpdateIkiminaSchema>;
