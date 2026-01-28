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
  EXTERNAL_DISCOVERY_ENABLED: z.string().optional(),
  MOLTBOT_BASE_URL: z.string().url().optional(),
  MOLTBOT_BEARER_TOKEN: z.string().optional(),
  MOLTBOT_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GEMINI_SEARCH_MODEL: z.string().optional(),
});

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
