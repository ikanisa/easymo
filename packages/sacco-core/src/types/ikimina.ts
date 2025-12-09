<<<<<<< HEAD
import { z } from 'zod';
=======
import { z } from "zod";
>>>>>>> feature/location-caching-and-mobility-deep-review

export const IkiminaSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  code: z.string(),
<<<<<<< HEAD
  name: z.string(),
  type: z.enum(['ASCA', 'VSLA', 'SILC', 'ROSCA']).default('ASCA'),
  settings_json: z.record(z.unknown()).default({}),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
=======
  name: z.string().min(1),
  type: z.enum(["ASCA", "ROSCA", "VSL"]).default("ASCA"),
  settings_json: z.record(z.unknown()).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DISSOLVED"]).default("ACTIVE"),
>>>>>>> feature/location-caching-and-mobility-deep-review
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Ikimina = z.infer<typeof IkiminaSchema>;
<<<<<<< HEAD

export const CreateIkiminaSchema = IkiminaSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CreateIkimina = z.infer<typeof CreateIkiminaSchema>;

export const UpdateIkiminaSchema = CreateIkiminaSchema.partial();

export type UpdateIkimina = z.infer<typeof UpdateIkiminaSchema>;
=======
export type IkiminaType = Ikimina["type"];
export type IkiminaStatus = Ikimina["status"];
>>>>>>> feature/location-caching-and-mobility-deep-review
