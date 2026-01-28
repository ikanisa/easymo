import { config } from "dotenv";
import { validateEnv } from "@easymo/commons";
import { z } from "zod";

config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  DEEP_RESEARCH_PORT: z.coerce.number().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(10),
});

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
