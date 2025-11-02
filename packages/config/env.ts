import { z } from "zod";

export const appEnvironmentSchema = z.enum(["development", "staging", "production"]);

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const baseEnvSchema = z.object({
  API_BASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  LOG_LEVEL: logLevelSchema.default("info"),
});

const developmentEnvSchema = baseEnvSchema
  .extend({
    APP_ENV: z.literal("development"),
    ENABLE_DEV_TOOLS: z.boolean().default(true),
  })
  .extend({
    LOG_LEVEL: logLevelSchema.default("debug"),
  });

const stagingEnvSchema = baseEnvSchema.extend({
  APP_ENV: z.literal("staging"),
  RELEASE_CHANNEL: z.literal("staging"),
});

const productionEnvSchema = baseEnvSchema
  .extend({
    APP_ENV: z.literal("production"),
    RELEASE_CHANNEL: z.literal("production"),
    ENABLE_DEV_TOOLS: z.boolean().default(false),
  })
  .extend({
    LOG_LEVEL: logLevelSchema.default("warn"),
  });

export const environmentSchemas = {
  development: developmentEnvSchema,
  staging: stagingEnvSchema,
  production: productionEnvSchema,
} as const satisfies Record<AppEnvironment, z.ZodTypeAny>;

export type DevelopmentEnv = z.infer<typeof developmentEnvSchema>;
export type StagingEnv = z.infer<typeof stagingEnvSchema>;
export type ProductionEnv = z.infer<typeof productionEnvSchema>;

export const featureFlagValueSchema = z
  .union([
    z.literal(true),
    z.literal(false),
    z.string().transform((value, ctx) => {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
        return true;
      }

      if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
        return false;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported boolean value: ${value}`,
      });
      return z.NEVER;
    }),
  ])
  .transform((value) => value);

export const featureFlagSchema = z.record(z.boolean());

export type FeatureFlags = z.infer<typeof featureFlagSchema>;

export interface LoadEnvOptions {
  featureFlagPrefix?: string;
  source?: NodeJS.ProcessEnv;
}

function normalizeEnvironment(value: string | undefined | null): AppEnvironment {
  if (!value) {
    return "development";
  }

  const normalized = value.toLowerCase();

  if (["production", "prod"].includes(normalized)) {
    return "production";
  }

  if (["staging", "stage"].includes(normalized)) {
    return "staging";
  }

  return "development";
}

function coerceBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  throw new Error(`Cannot coerce "${value}" to boolean`);
}

export function collectFeatureFlags(env: NodeJS.ProcessEnv, prefix = "FEATURE_"): FeatureFlags {
  const entries = Object.entries(env)
    .filter(([key]) => key.startsWith(prefix))
    .map(
      ([key, value]) =>
        [
          key.slice(prefix.length).toLowerCase().replace(/__+/g, "."),
          coerceBoolean(value),
        ] as const,
    );

  return featureFlagSchema.parse(Object.fromEntries(entries));
}

export type RuntimeEnv =
  | (DevelopmentEnv & { featureFlags: FeatureFlags })
  | (StagingEnv & { featureFlags: FeatureFlags })
  | (ProductionEnv & { featureFlags: FeatureFlags });

export function loadEnv(options: LoadEnvOptions = {}): RuntimeEnv {
  const source = options.source ?? process.env;
  const featureFlagPrefix = options.featureFlagPrefix ?? "FEATURE_";
  const targetEnv = normalizeEnvironment(source["APP_ENV"] ?? source["NODE_ENV"]);
  const schema = environmentSchemas[targetEnv];
  const resolved = schema.parse({ ...source, APP_ENV: targetEnv });
  const featureFlags = collectFeatureFlags(source, featureFlagPrefix);

  return {
    ...resolved,
    featureFlags,
  } as RuntimeEnv;
}

export function resolveEnvName(value: string | undefined | null): AppEnvironment {
  return normalizeEnvironment(value);
}
