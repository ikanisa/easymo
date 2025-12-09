import { z } from "zod";

const environmentSchema = z.enum([
  "development",
  "local",
  "preview",
  "staging",
  "production",
  "test",
]);

const runtimeConfigSchema = z.object({
  environment: environmentSchema,
  siteUrl: z.string().trim().url({ message: "siteUrl must be a valid URL" }).optional(),
  buildId: z
    .string()
    .trim()
    .min(1, { message: "buildId cannot be empty when provided" })
    .optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

let cachedConfig: RuntimeConfig | null = null;

function resolveEnvironment(): RuntimeConfig["environment"] {
  const raw =
    process.env.NEXT_PUBLIC_RUNTIME_ENV ??
    process.env.APP_ENV ??
    process.env.NODE_ENV ??
    "development";

  const parsed = environmentSchema.safeParse(raw);
  if (!parsed.success) {
    return "development";
  }

  return parsed.data;
}

function resolveSiteUrl(): string | undefined {
  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";
  if (publicUrl) {
    return publicUrl.startsWith("http") ? publicUrl : `https://${publicUrl}`;
  }

  return undefined;
}

function resolveBuildId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.GIT_COMMIT_SHA ??
    process.env.APP_COMMIT_SHA ??
    undefined
  );
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const candidate = {
    environment: resolveEnvironment(),
    siteUrl: resolveSiteUrl(),
    buildId: resolveBuildId(),
  } satisfies RuntimeConfig;

  const result = runtimeConfigSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(`Invalid runtime configuration: ${result.error.message}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Testing helper so integration tests can supply deterministic config values
 * without mutating process.env directly.
 */
export function __setRuntimeConfigForTests(config: RuntimeConfig | null): void {
  cachedConfig = config;
}

export const __runtimeConfigSchema = runtimeConfigSchema;
