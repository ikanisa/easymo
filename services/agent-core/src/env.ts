import { validateEnv } from "@easymo/commons";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(10),
  REDIS_URL: z.string().optional(),
  KAFKA_BROKERS: z.string().optional(),
});

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
