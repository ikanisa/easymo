import { validateEnv } from "@easymo/commons";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  PORT: z.coerce.number().default(4400),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  EXCHANGE_RATES_API: z.string().optional(),
});

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
