import { z } from "zod";

const STAGE_KEYS = ["DEPLOYMENT_ENV", "APP_ENV", "STAGE", "ENVIRONMENT", "NODE_ENV"] as const;
const BOOLEAN_TRUTHY = new Set(["true", "1", "yes", "on"]);
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  SUPABASE_URL: z.string({ required_error: "SUPABASE_URL is required" }).url(),
  SUPABASE_ANON_KEY: z.string({ required_error: "SUPABASE_ANON_KEY is required" }).min(1),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: "SUPABASE_SERVICE_ROLE_KEY is required" })
    .min(1),
  OPENAI_API_KEY: z.string({ required_error: "OPENAI_API_KEY is required" }).min(1),
  DATABASE_URL: z.string().url().optional(),
  API_BASE_URL: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
});

const developmentEnvironmentSchema = baseEnvironmentSchema.extend({
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/postgres"),
  API_BASE_URL: z.string().url().default("http://localhost:3000"),
});

const stagingEnvironmentSchema = baseEnvironmentSchema.extend({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required in staging" })
    .url({ message: "DATABASE_URL must be a valid URL" }),
  VERCEL_ENV: z.enum(["preview", "production"]).default("preview"),
});

const productionEnvironmentSchema = stagingEnvironmentSchema.extend({
  VERCEL_ENV: z.literal("production"),
});

const environmentSchemas = {
  development: developmentEnvironmentSchema,
  staging: stagingEnvironmentSchema,
  production: productionEnvironmentSchema,
} as const;

type EnvironmentSchemaMap = typeof environmentSchemas;
export type EnvironmentStage = keyof EnvironmentSchemaMap;
export type EnvironmentValuesMap = {
  [Stage in EnvironmentStage]: z.infer<EnvironmentSchemaMap[Stage]>;
};
export type EnvironmentValues = EnvironmentValuesMap[EnvironmentStage];

const featureFlagKeyMap = {
  agentChat: "FEATURE_AGENT_CHAT",
  agentVoice: "FEATURE_AGENT_VOICE",
  agentVouchers: "FEATURE_AGENT_VOUCHERS",
  agentCustomerLookup: "FEATURE_AGENT_CUSTOMER_LOOKUP",
  otelTracing: "ENABLE_OTEL_TRACING",
  costDashboard: "ENABLE_COST_DASHBOARD",
} as const;

const featureFlagEnvSchema = z.object({
  FEATURE_AGENT_CHAT: z.string().optional(),
  FEATURE_AGENT_VOICE: z.string().optional(),
  FEATURE_AGENT_VOUCHERS: z.string().optional(),
  FEATURE_AGENT_CUSTOMER_LOOKUP: z.string().optional(),
  ENABLE_OTEL_TRACING: z.string().optional(),
  ENABLE_COST_DASHBOARD: z.string().optional(),
});

export type RuntimeFeatureFlagName = keyof typeof featureFlagKeyMap;
export type RuntimeFeatureFlagState = Record<RuntimeFeatureFlagName, boolean>;

export type RuntimeFeatureFlags = {
  readonly flags: RuntimeFeatureFlagState;
  readonly enabled: RuntimeFeatureFlagName[];
  isEnabled: (flag: RuntimeFeatureFlagName) => boolean;
};

const normalizeStage = (rawValue: string | undefined): EnvironmentStage => {
  if (!rawValue) {
    return "development";
  }

  const normalized = rawValue.toLowerCase();
  if (normalized.startsWith("prod")) {
    return "production";
  }

  if (normalized.startsWith("stage") || normalized === "preview") {
    return "staging";
  }

  return "development";
};

const coerceBoolean = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  return BOOLEAN_TRUTHY.has(value.toLowerCase());
};

export const detectStage = (env: NodeJS.ProcessEnv = process.env): EnvironmentStage => {
  for (const key of STAGE_KEYS) {
    const value = env[key];
    if (value) {
      return normalizeStage(value);
    }
  }

  return "development";
};

export const parseRuntimeFeatureFlags = (
  env: NodeJS.ProcessEnv = process.env,
): RuntimeFeatureFlags => {
  const raw = featureFlagEnvSchema.parse(env) as Record<string, string | undefined>;
  const flagsEntries = Object.entries(featureFlagKeyMap).map(([name, envKey]) => [
    name,
    coerceBoolean(raw[envKey]),
  ]);

  const flags = Object.fromEntries(flagsEntries) as RuntimeFeatureFlagState;
  const enabled = flagsEntries
    .filter(([, isEnabled]) => isEnabled)
    .map(([name]) => name as RuntimeFeatureFlagName);

  return {
    flags,
    enabled,
    isEnabled: (flag: RuntimeFeatureFlagName) => flags[flag],
  };
};

export type LoadedEnvironment = {
  stage: EnvironmentStage;
  values: EnvironmentValues;
  featureFlags: RuntimeFeatureFlags;
};

export const loadEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
): LoadedEnvironment => {
  const stage = detectStage(env);
  const schema = environmentSchemas[stage];
  const values = schema.parse(env) as EnvironmentValues;
  const featureFlags = parseRuntimeFeatureFlags(env);

  return {
    stage,
    values,
    featureFlags,
  };
};

export const getEnvironmentSchema = (
  stage: EnvironmentStage,
): EnvironmentSchemaMap[EnvironmentStage] => environmentSchemas[stage];
