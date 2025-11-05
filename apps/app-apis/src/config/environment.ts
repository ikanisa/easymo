import { z } from "zod";

export type FeatureFlagKey =
  | "favorites"
  | "driver"
  | "match"
  | "deeplink"
  | "broker"
  | "admin";

export interface Environment {
  supabase: {
    url: string;
    key: string;
    schema: string;
  };
  featureFlags: Record<FeatureFlagKey, boolean>;
  cache: {
    ttlMs: number;
    maxSize: number;
  };
}

const RawEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().url().default("http://localhost:54321"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .default("local-service-role-key"),
  SUPABASE_SCHEMA: z.string().min(1).default("public"),
  FEATURE_FLAGS: z.string().optional(),
  CACHE_TTL_MS: z.coerce.number().int().positive().default(1_000),
  CACHE_MAX_SIZE: z.coerce.number().int().positive().default(500),
});

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  favorites: true,
  driver: true,
  match: true,
  deeplink: true,
  broker: true,
  admin: true,
};

let cachedEnvironment: Environment | null = null;

const parseFeatureFlags = (value: string | undefined): Record<FeatureFlagKey, boolean> => {
  if (!value) {
    return { ...DEFAULT_FLAGS };
  }

  const entries = value
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, rawEnabled] = pair.split("=");
      const normalizedKey = key?.trim() as FeatureFlagKey | undefined;
      if (!normalizedKey || !(normalizedKey in DEFAULT_FLAGS)) {
        return undefined;
      }

      const enabled = rawEnabled ? rawEnabled.trim().toLowerCase() !== "false" : true;
      return [normalizedKey, enabled] as const;
    })
    .filter((entry): entry is readonly [FeatureFlagKey, boolean] => Boolean(entry));

  return entries.reduce<Record<FeatureFlagKey, boolean>>(
    (acc, [key, enabled]) => ({
      ...acc,
      [key]: enabled,
    }),
    { ...DEFAULT_FLAGS }
  );
};

export const loadEnvironment = (
  rawEnv: NodeJS.ProcessEnv = process.env
): Environment => {
  const parsed = RawEnvironmentSchema.parse(rawEnv);

  return {
    supabase: {
      url: parsed.SUPABASE_URL,
      key: parsed.SUPABASE_SERVICE_ROLE_KEY,
      schema: parsed.SUPABASE_SCHEMA,
    },
    featureFlags: parseFeatureFlags(parsed.FEATURE_FLAGS),
    cache: {
      ttlMs: parsed.CACHE_TTL_MS,
      maxSize: parsed.CACHE_MAX_SIZE,
    },
  };
};

export const getEnvironment = (): Environment => {
  if (!cachedEnvironment) {
    cachedEnvironment = loadEnvironment();
  }

  return cachedEnvironment;
};

export const setEnvironmentForTests = (env: Environment | null) => {
  cachedEnvironment = env;
};
