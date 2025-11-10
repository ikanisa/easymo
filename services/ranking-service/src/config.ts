import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4500),
  LOG_LEVEL: z.string().default("info"),
  DEFAULT_TENANT_ID: z.string().uuid().default("a4a8cf2d-0a4f-446c-8bf2-28509641158f"),
  EASYMO_ADMIN_API_BASE: z.string().url().optional(),
  EASYMO_ADMIN_TOKEN: z.string().optional(),
  EASYMO_ADMIN_ACTOR_ID: z.string().uuid().optional(),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  defaultTenantId: parsed.DEFAULT_TENANT_ID,
  easymoAdminApiBase: parsed.EASYMO_ADMIN_API_BASE,
  easymoAdminToken: parsed.EASYMO_ADMIN_TOKEN,
  easymoAdminActorId: parsed.EASYMO_ADMIN_ACTOR_ID,
};
