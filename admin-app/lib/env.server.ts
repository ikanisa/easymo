import { z } from "zod";

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    NEXT_PUBLIC_USE_MOCKS: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SERVICE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SERVICE_ROLE_KEY: z.string().optional(),
    ADMIN_SESSION_SECRET: z.string().optional(),
    ADMIN_SESSION_SECRET_FALLBACK: z.string().optional(),
    ADMIN_SESSION_TTL_SECONDS: z.string().optional(),
    ADMIN_ACCESS_CREDENTIALS: z.string().optional(),
    ADMIN_ACCESS_TOKENS: z.string().optional(),
    ADMIN_ALLOW_ANY_ACTOR: z.string().optional(),
    ADMIN_TEST_ACTOR_ID: z.string().optional(),
    ADMIN_FLOW_WA_ID: z.string().optional(),
    AGENT_CORE_URL: z.string().optional(),
    NEXT_PUBLIC_AGENT_CORE_URL: z.string().optional(),
    VOICE_BRIDGE_API_URL: z.string().optional(),
    NEXT_PUBLIC_VOICE_BRIDGE_API_URL: z.string().optional(),
    MARKETPLACE_VENDOR_URL: z.string().optional(),
    NEXT_PUBLIC_MARKETPLACE_VENDOR_URL: z.string().optional(),
    MARKETPLACE_BUYER_URL: z.string().optional(),
    NEXT_PUBLIC_MARKETPLACE_BUYER_URL: z.string().optional(),
    MARKETPLACE_RANKING_URL: z.string().optional(),
    NEXT_PUBLIC_MARKETPLACE_RANKING_URL: z.string().optional(),
    WALLET_SERVICE_URL: z.string().optional(),
    NEXT_PUBLIC_WALLET_SERVICE_URL: z.string().optional(),
    LOG_DRAIN_URL: z.string().optional(),
    METRICS_DRAIN_URL: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    WHATSAPP_SEND_ENDPOINT: z.string().optional(),
    WHATSAPP_SEND_TIMEOUT_MS: z.string().optional(),
    WHATSAPP_SEND_RETRIES: z.string().optional(),
    VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
  })
  .passthrough();

type RawEnv = z.infer<typeof rawEnvSchema>;

const parsed = rawEnvSchema.parse(process.env) as RawEnv;

const toBoolean = (value: string | undefined, fallback = false): boolean => {
  if (typeof value !== "string") return fallback;
  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
};

const coerceString = (value: string | undefined | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const parseInteger = (value: string | undefined, fallback?: number, label = 'value'): number | null => {
  if (!value) return typeof fallback === "number" ? fallback : null;
  const parsedInt = Number.parseInt(value, 10);
  if (Number.isNaN(parsedInt) || parsedInt <= 0) {
    throw new Error(`Invalid integer value for ${label}: ${value}`);
  }
  return parsedInt;
};

const useMocks = toBoolean(parsed.NEXT_PUBLIC_USE_MOCKS, false);
const isTest = parsed.NODE_ENV === "test";

const supabaseClientUrl = coerceString(parsed.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = coerceString(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseServiceUrl =
  coerceString(parsed.SUPABASE_URL)
  ?? coerceString(parsed.SERVICE_URL)
  ?? supabaseClientUrl;
const supabaseServiceRoleKey =
  coerceString(parsed.SUPABASE_SERVICE_ROLE_KEY)
  ?? coerceString(parsed.SERVICE_ROLE_KEY);

if (!useMocks && !isTest) {
  if (!supabaseClientUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required when mocks are disabled.");
  }
  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required when mocks are disabled.");
  }
  if (!supabaseServiceUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SERVICE_URL/SERVICE_ROLE_KEY) are required when mocks are disabled.",
    );
  }
}

const sessionSecret = coerceString(parsed.ADMIN_SESSION_SECRET)
  ?? (isTest ? "test-session-secret-123456789" : undefined);
if (!sessionSecret || sessionSecret.length < 16) {
  throw new Error("ADMIN_SESSION_SECRET must be at least 16 characters long.");
}

const sessionSecretFallback = coerceString(parsed.ADMIN_SESSION_SECRET_FALLBACK);
if (sessionSecretFallback && sessionSecretFallback.length < 16) {
  throw new Error("ADMIN_SESSION_SECRET_FALLBACK must be at least 16 characters long when provided.");
}

const sessionTtlSeconds = parseInteger(parsed.ADMIN_SESSION_TTL_SECONDS, 60 * 60 * 24 * 7, 'ADMIN_SESSION_TTL_SECONDS')
  ?? 60 * 60 * 24 * 7;

const prefer = (primary: string | undefined, secondary: string | undefined): string | null => {
  return coerceString(primary) ?? coerceString(secondary) ?? null;
};

export const env = {
  nodeEnv: parsed.NODE_ENV,
  useMocks,
  supabase: {
    client: {
      url: supabaseClientUrl ?? null,
      anonKey: supabaseAnonKey ?? null,
    },
    service: {
      url: supabaseServiceUrl ?? null,
      serviceRoleKey: supabaseServiceRoleKey ?? null,
    },
  },
  admin: {
    sessionSecret,
    sessionSecretFallback: sessionSecretFallback ?? null,
    sessionTtlSeconds,
  },
  serviceUrls: {
    agentCore: prefer(parsed.AGENT_CORE_URL, parsed.NEXT_PUBLIC_AGENT_CORE_URL),
    voiceBridge: prefer(parsed.VOICE_BRIDGE_API_URL, parsed.NEXT_PUBLIC_VOICE_BRIDGE_API_URL),
    marketplace: {
      ranking: prefer(parsed.MARKETPLACE_RANKING_URL, parsed.NEXT_PUBLIC_MARKETPLACE_RANKING_URL),
      vendor: prefer(parsed.MARKETPLACE_VENDOR_URL, parsed.NEXT_PUBLIC_MARKETPLACE_VENDOR_URL),
      buyer: prefer(parsed.MARKETPLACE_BUYER_URL, parsed.NEXT_PUBLIC_MARKETPLACE_BUYER_URL),
      wallet: prefer(parsed.WALLET_SERVICE_URL, parsed.NEXT_PUBLIC_WALLET_SERVICE_URL),
    },
  },
  logging: {
    drainUrl: coerceString(parsed.LOG_DRAIN_URL) ?? null,
    metricsUrl: coerceString(parsed.METRICS_DRAIN_URL) ?? null,
  },
  sentry: {
    serverDsn: coerceString(parsed.SENTRY_DSN) ?? null,
    clientDsn: coerceString(parsed.NEXT_PUBLIC_SENTRY_DSN) ?? null,
  },
  whatsapp: {
    endpoint: coerceString(parsed.WHATSAPP_SEND_ENDPOINT) ?? null,
    timeoutMs: parseInteger(parsed.WHATSAPP_SEND_TIMEOUT_MS, undefined, 'WHATSAPP_SEND_TIMEOUT_MS'),
    maxRetries: parseInteger(parsed.WHATSAPP_SEND_RETRIES, undefined, 'WHATSAPP_SEND_RETRIES'),
  },
  raw: parsed,
};

export const envBoolean = toBoolean;
