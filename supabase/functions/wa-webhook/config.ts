import {
  createClient,
  createClientFactory,
  type SupabaseClient,
} from "./deps.ts";
import { getEnv as getSharedEnv } from "../_shared/env.ts";

function getEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = getSharedEnv(name);
    if (value) return value;
  }
  return undefined;
}

function mustGetOne(...names: string[]): string {
  const value = getEnv(...names);
  if (!value) {
    throw new Error(`Missing required env: ${names.join("/")}`);
  }
  return value;
}

export const SUPABASE_URL = mustGetOne("SUPABASE_URL", "SERVICE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = mustGetOne(
  "WA_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
);
if (!getEnv("WA_SUPABASE_SERVICE_ROLE_KEY")) {
  console.warn("wa_webhook.service_key_fallback");
}
export const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY") ?? "";
export const WA_PHONE_ID = mustGetOne(
  "WA_PHONE_ID",
  "WHATSAPP_PHONE_NUMBER_ID",
);
export const WA_TOKEN = mustGetOne("WA_TOKEN", "WHATSAPP_ACCESS_TOKEN");
export const WA_APP_SECRET = mustGetOne("WA_APP_SECRET", "WHATSAPP_APP_SECRET");
export const WA_VERIFY_TOKEN = mustGetOne(
  "WA_VERIFY_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
);
export const OPENAI_API_KEY = getEnv("OPENAI_API_KEY") ?? "";
export const GEMINI_API_KEY = getEnv("GEMINI_API_KEY") ?? "";
export const WA_BOT_NUMBER_E164 =
  getEnv("WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164") ?? "";
export const QR_SALT = getEnv("QR_SALT") ?? "";
export const MENU_MEDIA_BUCKET = getEnv("MENU_MEDIA_BUCKET") ??
  "menu-source-files";
export const INSURANCE_MEDIA_BUCKET = getEnv("INSURANCE_MEDIA_BUCKET") ??
  "insurance-docs";
export const SCHEDULE_TIME_FLOW_ID = getEnv("WA_FLOW_SCHEDULE_TIME_ID") ?? "";

const clientFactory: typeof createClient = typeof createClientFactory ===
    "function"
  ? createClientFactory as typeof createClient
  : createClient;

export const supabase: SupabaseClient = clientFactory(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    global: { fetch: fetch.bind(globalThis) },
  },
);

export function assertRuntimeReady(): void {
  const required = [
    ["SUPABASE_URL", "SERVICE_URL"],
    [
      "SUPABASE_SERVICE_ROLE_KEY",
      "SERVICE_ROLE_KEY",
      "WA_SUPABASE_SERVICE_ROLE_KEY",
    ],
    ["WA_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID"],
    ["WA_TOKEN", "WHATSAPP_ACCESS_TOKEN"],
    ["WA_APP_SECRET", "WHATSAPP_APP_SECRET"],
    ["WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"],
    ["WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164"],
  ];
  const missing = required.filter((candidates) => !getEnv(...candidates))
    .map((candidates) => candidates.join("/"));
  if (missing.length) {
    throw new Error(`Missing required envs: ${missing.join(", ")}`);
  }
}

/**
 * Enhanced webhook configuration for security, performance, and monitoring
 */
export const webhookConfig = {
  // Rate limiting
  rateLimit: {
    enabled: getEnv("ENABLE_RATE_LIMITING") !== "false",
    windowMs: parseInt(getEnv("RATE_LIMIT_WINDOW_MS") || "60000"), // 1 minute
    maxRequests: parseInt(getEnv("RATE_LIMIT_MAX_REQUESTS") || "100"),
    keyPrefix: "wa-webhook",
  },

  // Caching
  cache: {
    enabled: getEnv("ENABLE_CACHING") !== "false",
    defaultTTL: parseInt(getEnv("CACHE_DEFAULT_TTL") || "300"), // 5 minutes
    maxSize: parseInt(getEnv("CACHE_MAX_SIZE") || "1000"),
    checkPeriod: parseInt(getEnv("CACHE_CHECK_PERIOD") || "600"), // 10 minutes
  },

  // AI Agents
  aiAgents: {
    enabled: getEnv("ENABLE_AI_AGENTS") === "true",
    redisUrl: getEnv("REDIS_URL") ?? "redis://localhost:6379",
    defaultModel: getEnv("AI_DEFAULT_MODEL") || "gpt-4o-mini",
    maxTokens: parseInt(getEnv("AI_MAX_TOKENS") || "1000"),
    temperature: parseFloat(getEnv("AI_TEMPERATURE") || "0.7"),
  },

  // Monitoring
  monitoring: {
    enabled: getEnv("ENABLE_MONITORING") !== "false",
    logLevel: getEnv("LOG_LEVEL") || "info",
    sentryDsn: getEnv("SENTRY_DSN") ?? "",
  },

  // Error handling
  error: {
    notifyUser: getEnv("ERROR_NOTIFY_USER") !== "false",
    includeStack: getEnv("ENVIRONMENT") === "development",
    maxRetries: parseInt(getEnv("ERROR_MAX_RETRIES") || "3"),
  },

  // Webhook verification
  verification: {
    enabled: getEnv("SKIP_SIGNATURE_VERIFICATION") !== "true",
  },
};
