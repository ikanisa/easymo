import { config } from "dotenv";
import { z } from "zod";

config();

const schema = z.object({
  PORT: z.coerce.number().default(4600),
  LOG_LEVEL: z.string().default("info"),
  DEFAULT_TENANT_ID: z.string().uuid().default("a4a8cf2d-0a4f-446c-8bf2-28509641158f"),
});

const parsed = schema.parse(process.env);

export const settings = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  defaultTenantId: parsed.DEFAULT_TENANT_ID,
};
