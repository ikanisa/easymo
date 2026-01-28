import { validateEnv } from "@easymo/commons";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  PORT: z.coerce.number().default(4800),
  LOG_LEVEL: z.string().default("info"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
