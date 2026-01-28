import { config } from "dotenv";
import { validateEnv } from "@easymo/commons";
import { z } from "zod";

config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  VOICE_GATEWAY_PORT: z.coerce.number().default(3030),
  LOG_LEVEL: z.string().default("info"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_REALTIME_MODEL: z.string().optional(),
  VOICE_STT_PROVIDER: z.string().optional(),
  VOICE_TTS_PROVIDER: z.string().optional(),
  VOICE_TRANSLATE_PROVIDER: z.string().optional(),
  VOICE_ENABLE_FALLBACK: z.string().optional(),
});

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
