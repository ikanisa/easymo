import { z } from "zod";
import { requiredEnvConfig } from "./data/requiredEnvConfig";

type ProcessEnvSource = Partial<Record<string, string | undefined>>;

function buildRawEnv(source: ProcessEnvSource) {
  const analyticsCacheToken = source.ANALYTICS_CACHE_TOKEN?.trim();

  return {
    NODE_ENV: source.NODE_ENV ?? "development",
    APP_ENV: source.APP_ENV ?? source.NODE_ENV ?? "development",
    NETLIFY_CONTEXT: source.NETLIFY_CONTEXT ?? source.CONTEXT,
    APP_REGION: source.APP_REGION,
    GIT_COMMIT_SHA: source.GIT_COMMIT_SHA,
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_BUILD_ID: source.NEXT_PUBLIC_BUILD_ID,
    NEXT_PUBLIC_E2E: source.NEXT_PUBLIC_E2E,
    NEXT_PUBLIC_SENTRY_DSN: source.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_DSN: source.SENTRY_DSN,
    SENTRY_TRACES_SAMPLE_RATE: source.SENTRY_TRACES_SAMPLE_RATE,
    SENTRY_PROFILES_SAMPLE_RATE: source.SENTRY_PROFILES_SAMPLE_RATE,
    POSTHOG_API_KEY: source.POSTHOG_API_KEY,
    POSTHOG_HOST: source.POSTHOG_HOST,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
    RATE_LIMIT_SECRET: source.RATE_LIMIT_SECRET,
    ANALYTICS_CACHE_TOKEN:
      analyticsCacheToken && analyticsCacheToken.length > 0 ? analyticsCacheToken : undefined,
    REPORT_SIGNING_KEY: source.REPORT_SIGNING_KEY,
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    OPENAI_OCR_MODEL: source.OPENAI_OCR_MODEL ?? "gpt-4.1-mini",
    OPENAI_RESPONSES_MODEL: source.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini",
    MAIL_FROM: source.MAIL_FROM ?? "SACCO+ <no-reply@sacco.plus>",
    SMTP_HOST: source.SMTP_HOST,
    SMTP_PORT: source.SMTP_PORT ?? "587",
    SMTP_USER: source.SMTP_USER,
    SMTP_PASS: source.SMTP_PASS,
    LOG_DRAIN_URL: source.LOG_DRAIN_URL,
    LOG_DRAIN_TOKEN: source.LOG_DRAIN_TOKEN,
    LOG_DRAIN_SOURCE: source.LOG_DRAIN_SOURCE,
    LOG_DRAIN_TIMEOUT_MS: source.LOG_DRAIN_TIMEOUT_MS ?? "2000",
    LOG_DRAIN_ALERT_WEBHOOK: source.LOG_DRAIN_ALERT_WEBHOOK,
    LOG_DRAIN_ALERT_TOKEN: source.LOG_DRAIN_ALERT_TOKEN,
    LOG_DRAIN_ALERT_COOLDOWN_MS: source.LOG_DRAIN_ALERT_COOLDOWN_MS ?? "300000",
    LOG_DRAIN_SILENT: source.LOG_DRAIN_SILENT,
    HMAC_SHARED_SECRET: source.HMAC_SHARED_SECRET,
    META_WHATSAPP_ACCESS_TOKEN: source.META_WHATSAPP_ACCESS_TOKEN,
    META_WHATSAPP_PHONE_NUMBER_ID: source.META_WHATSAPP_PHONE_NUMBER_ID,
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: source.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
    SITE_URL: source.SITE_URL,
    EDGE_URL: source.EDGE_URL,
    DISABLE_PWA: source.DISABLE_PWA,
    ANALYZE_BUNDLE: source.ANALYZE_BUNDLE,
    AUTH_E2E_STUB: source.AUTH_E2E_STUB,
    AUTH_GUEST_MODE: source.AUTH_GUEST_MODE,
    PLAYWRIGHT_BASE_URL: source.PLAYWRIGHT_BASE_URL,
    PLAYWRIGHT_SUPABASE_URL: source.PLAYWRIGHT_SUPABASE_URL,
    PLAYWRIGHT_SUPABASE_ANON_KEY: source.PLAYWRIGHT_SUPABASE_ANON_KEY,
    CI: source.CI,
    CONFIGCAT_OFFERS_SDK_KEY: source.CONFIGCAT_OFFERS_SDK_KEY,
    CONFIGCAT_ENVIRONMENT: source.CONFIGCAT_ENVIRONMENT,
    CONFIGCAT_OFFERS_FALLBACK: source.CONFIGCAT_OFFERS_FALLBACK,
    CONFIGCAT_OFFERS_OVERRIDES: source.CONFIGCAT_OFFERS_OVERRIDES,
    CONFIGCAT_SETTINGS_URL: source.CONFIGCAT_SETTINGS_URL,
    AI_AGENT_SESSION_STORE: source.AI_AGENT_SESSION_STORE ?? "supabase",
    AI_AGENT_SESSION_TTL_SECONDS: source.AI_AGENT_SESSION_TTL_SECONDS ?? "3600",
    AI_AGENT_RATE_LIMIT_MAX_REQUESTS: source.AI_AGENT_RATE_LIMIT_MAX_REQUESTS ?? "60",
    AI_AGENT_RATE_LIMIT_WINDOW_SECONDS: source.AI_AGENT_RATE_LIMIT_WINDOW_SECONDS ?? "60",
    AI_AGENT_USAGE_LOG_ENABLED: source.AI_AGENT_USAGE_LOG_ENABLED ?? "true",
    AI_AGENT_USAGE_LOG_TABLE: source.AI_AGENT_USAGE_LOG_TABLE ?? "agent_usage_events",
    AI_AGENT_OPTOUT_TABLE: source.AI_AGENT_OPTOUT_TABLE ?? "agent_opt_outs",
    AI_AGENT_REDIS_URL: source.AI_AGENT_REDIS_URL,
  } as Record<string, string | undefined>;
}

const optionalString = z.string().trim().min(1).optional();

const positiveNumberString = z
  .string()
  .trim()
  .regex(/^\d+$/, { message: "Expected a positive integer" });

function isProductionLikeContext({
  appEnv,
  nodeEnv,
  netlifyContext,
}: {
  appEnv: string;
  nodeEnv: string;
  netlifyContext?: string;
}) {
  const normalizedContext = netlifyContext?.trim().toLowerCase();
  if (normalizedContext && ["production", "prod"].includes(normalizedContext)) {
    return true;
  }
  return appEnv === "production" || nodeEnv === "production";
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_ENV: z
      .enum(["development", "test", "preview", "staging", "production"])
      .default("development"),
    NETLIFY_CONTEXT: optionalString,
    APP_REGION: optionalString,
    GIT_COMMIT_SHA: optionalString,
    NEXT_PUBLIC_SUPABASE_URL: z
      .string({ required_error: "NEXT_PUBLIC_SUPABASE_URL is required" })
      .trim()
      .url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string({ required_error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" })
      .trim()
      .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
    NEXT_PUBLIC_SITE_URL: optionalString,
    NEXT_PUBLIC_BUILD_ID: optionalString,
    NEXT_PUBLIC_E2E: optionalString,
    NEXT_PUBLIC_SENTRY_DSN: optionalString,
    SENTRY_DSN: optionalString,
    SENTRY_TRACES_SAMPLE_RATE: optionalString,
    SENTRY_PROFILES_SAMPLE_RATE: optionalString,
    POSTHOG_API_KEY: optionalString,
    POSTHOG_HOST: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: z
      .string({ required_error: "SUPABASE_SERVICE_ROLE_KEY is required" })
      .trim()
      .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
    RATE_LIMIT_SECRET: optionalString,
    ANALYTICS_CACHE_TOKEN: optionalString,
    REPORT_SIGNING_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    OPENAI_OCR_MODEL: z.string().trim().min(1),
    OPENAI_RESPONSES_MODEL: z.string().trim().min(1),
    MAIL_FROM: z.string().trim().min(3),
    SMTP_HOST: optionalString,
    SMTP_PORT: positiveNumberString,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    LOG_DRAIN_URL: optionalString,
    LOG_DRAIN_TOKEN: optionalString,
    LOG_DRAIN_SOURCE: optionalString,
    LOG_DRAIN_TIMEOUT_MS: positiveNumberString,
    LOG_DRAIN_ALERT_WEBHOOK: optionalString,
    LOG_DRAIN_ALERT_TOKEN: optionalString,
    LOG_DRAIN_ALERT_COOLDOWN_MS: positiveNumberString,
    LOG_DRAIN_SILENT: optionalString,
    HMAC_SHARED_SECRET: optionalString,
    META_WHATSAPP_ACCESS_TOKEN: optionalString,
    META_WHATSAPP_PHONE_NUMBER_ID: optionalString,
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
    SITE_URL: optionalString,
    EDGE_URL: optionalString,
    DISABLE_PWA: optionalString,
    ANALYZE_BUNDLE: optionalString,
    AUTH_E2E_STUB: optionalString,
    AUTH_GUEST_MODE: optionalString,
    PLAYWRIGHT_BASE_URL: optionalString,
    PLAYWRIGHT_SUPABASE_URL: optionalString,
    PLAYWRIGHT_SUPABASE_ANON_KEY: optionalString,
    CI: optionalString,
    CONFIGCAT_OFFERS_SDK_KEY: optionalString,
    CONFIGCAT_ENVIRONMENT: optionalString,
    CONFIGCAT_OFFERS_FALLBACK: optionalString,
    CONFIGCAT_OFFERS_OVERRIDES: optionalString,
    CONFIGCAT_SETTINGS_URL: optionalString,
    AI_AGENT_SESSION_STORE: z.enum(["supabase", "redis"]).default("supabase"),
    AI_AGENT_SESSION_TTL_SECONDS: positiveNumberString,
    AI_AGENT_RATE_LIMIT_MAX_REQUESTS: positiveNumberString,
    AI_AGENT_RATE_LIMIT_WINDOW_SECONDS: positiveNumberString,
    AI_AGENT_USAGE_LOG_ENABLED: z.string().default("true"),
    AI_AGENT_USAGE_LOG_TABLE: z.string().default("agent_usage_events"),
    AI_AGENT_OPTOUT_TABLE: z.string().default("agent_opt_outs"),
    AI_AGENT_REDIS_URL: optionalString,
  })
  .superRefine((values, ctx) => {
    const requiresOpenAiKey = isProductionLikeContext({
      appEnv: values.APP_ENV,
      nodeEnv: values.NODE_ENV,
      netlifyContext: values.NETLIFY_CONTEXT,
    });

    if (requiresOpenAiKey && (!values.OPENAI_API_KEY || values.OPENAI_API_KEY.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENAI_API_KEY is required in production deployments.",
        path: ["OPENAI_API_KEY"],
      });
    }
  });

export type RawEnv = z.infer<typeof schema>;

function withStubFallbacks(raw: ProcessEnvSource): ProcessEnvSource {
  const nodeEnv = raw.NODE_ENV ?? "development";
  const isDevelopmentMode = nodeEnv === "development" || nodeEnv === "test";
  const isStubMode = raw.AUTH_E2E_STUB === "1" || raw.AUTH_GUEST_MODE === "1";

  if (!isDevelopmentMode && !isStubMode) {
    return raw;
  }

  const stubbedDefaults = Object.freeze({
    NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.local",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "stub-service-role-key",
    HMAC_SHARED_SECRET: "stub-hmac-shared-secret",
    OPENAI_API_KEY: "stub-openai-api-key",
  } as const);

  const withFallback = (value: string | undefined, fallback: string) => {
    if (typeof value === "string" && value.trim().length > 0 && value.trim() !== "-") {
      return value;
    }
    return fallback;
  };

  const augmented: ProcessEnvSource = { ...raw };

  const applyWithFallback = (key: keyof typeof stubbedDefaults) => {
    const fallback = stubbedDefaults[key];
    const original = raw[key];
    const value = withFallback(original, fallback);
    augmented[key] = value;

    if (typeof original !== "string" || original.trim().length === 0 || original.trim() === "-") {
      process.env[key] = value;
    }
  };

  applyWithFallback("NEXT_PUBLIC_SUPABASE_URL");
  applyWithFallback("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  applyWithFallback("SUPABASE_SERVICE_ROLE_KEY");
  applyWithFallback("HMAC_SHARED_SECRET");
  applyWithFallback("OPENAI_API_KEY");

  return augmented;
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseSampleRateValue(value: string | undefined, fallback: number): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

export type ServerEnv = ReturnType<typeof prepareServerEnv>;

function prepareServerEnv(parsedEnv: RawEnv) {
  const rateLimitSecret = parsedEnv.RATE_LIMIT_SECRET ?? parsedEnv.HMAC_SHARED_SECRET;

  return Object.freeze({
    ...parsedEnv,
    LOG_DRAIN_TIMEOUT_MS: parsePositiveInteger(parsedEnv.LOG_DRAIN_TIMEOUT_MS, 2000),
    LOG_DRAIN_ALERT_COOLDOWN_MS: parsePositiveInteger(
      parsedEnv.LOG_DRAIN_ALERT_COOLDOWN_MS,
      5 * 60 * 1000
    ),
    SMTP_PORT: parsePositiveInteger(parsedEnv.SMTP_PORT, 587),
    SENTRY_TRACES_SAMPLE_RATE: parseSampleRateValue(
      parsedEnv.SENTRY_TRACES_SAMPLE_RATE,
      parsedEnv.APP_ENV === "production" ? 0.2 : 1
    ),
    SENTRY_PROFILES_SAMPLE_RATE: parseSampleRateValue(
      parsedEnv.SENTRY_PROFILES_SAMPLE_RATE,
      parsedEnv.APP_ENV === "production" ? 0.1 : 1
    ),
    rateLimitSecret,
  });
}

function loadRawEnv(source: ProcessEnvSource): RawEnv {
  const base = buildRawEnv(source);
  const envWithFallbacks = withStubFallbacks(base);

  try {
    return schema.parse(envWithFallbacks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => `- ${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("\n");
      console.error("\nEnvironment validation failed:\n" + details + "\n");
    }
    throw error;
  }
}

let cachedServerEnv: ServerEnv | null = null;

export function loadServerEnv(overrides: ProcessEnvSource = process.env): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = loadRawEnv(overrides);
  cachedServerEnv = prepareServerEnv(parsed);
  return cachedServerEnv;
}

export const env = loadServerEnv();

export const clientEnv = Object.freeze({
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL ?? null,
  NEXT_PUBLIC_BUILD_ID: env.NEXT_PUBLIC_BUILD_ID ?? null,
  NEXT_PUBLIC_SENTRY_DSN: env.NEXT_PUBLIC_SENTRY_DSN ?? null,
});

export const requiredServerEnv: ReadonlyArray<string> = Object.freeze(requiredEnvConfig.required);
export const atLeastOneServerEnv: ReadonlyArray<ReadonlyArray<string>> = Object.freeze(
  requiredEnvConfig.atLeastOne.map((group) => [...group])
);

export type ClientEnv = typeof clientEnv;
export type RequiredServerEnvGroups = typeof atLeastOneServerEnv;
