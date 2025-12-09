import { z } from "zod";

export const IkiminaSchema = z.object({
  id: z.string().uuid(),
  sacco_id: z.string().uuid(),
  code: z.string(),
  name: z.string().min(1),
  type: z.enum(["ASCA", "ROSCA", "VSL"]).default("ASCA"),
  settings_json: z.record(z.unknown()).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DISSOLVED"]).default("ACTIVE"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Ikimina = z.infer<typeof IkiminaSchema>;
export type IkiminaType = Ikimina["type"];
export type IkiminaStatus = Ikimina["status"];
