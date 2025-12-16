/**
 * Enhanced Configuration Validation for wa-webhook
 *
 * Validates all required environment variables and provides defaults.
 * Complements existing config.ts without modifying it.
 *
 * @see docs/GROUND_RULES.md
 */

import { logStructuredEvent } from "../../_shared/observability.ts";

interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface EnvConfig {
  // WhatsApp
  waPhoneId: string;
  waToken: string;
  waAppSecret: string;
  waVerifyToken: string;
  waBotNumberE164: string;

  // Supabase
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey?: string;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  rateLimitBlacklistThreshold: number;

  // Caching
  cacheDefaultTTL: number;
  cacheMaxSize: number;
  cacheCheckPeriod: number;

  // Performance
  webhookMaxBytes: number;
  httpTimeoutMs: number;
  httpMaxRetries: number;
  httpRetryDelayMs: number;

  // Feature Flags
  enableRateLimiting: boolean;
  enableCaching: boolean;
  enableUserErrorNotifications: boolean;

  // Environment
  environment: string;
}

/**
 * Validate and load configuration
 */
export function validateAndLoadConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  const requiredEnvVars = [
    {
      keys: ["WA_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID"],
      name: "WhatsApp Phone ID",
    },
    { keys: ["WA_TOKEN", "WHATSAPP_ACCESS_TOKEN"], name: "WhatsApp Token" },
    {
      keys: ["WA_APP_SECRET", "WHATSAPP_APP_SECRET"],
      name: "WhatsApp App Secret",
    },
    {
      keys: ["WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN"],
      name: "WhatsApp Verify Token",
    },
    { keys: ["SUPABASE_URL", "SERVICE_URL"], name: "Supabase URL" },
    {
      keys: [
        "SUPABASE_SERVICE_ROLE_KEY",
        "SERVICE_ROLE_KEY",
        "WA_SUPABASE_SERVICE_ROLE_KEY",
      ],
      name: "Supabase Service Role Key",
    },
  ];

  for (const envVar of requiredEnvVars) {
    if (!getEnv(...envVar.keys)) {
      errors.push(
        `Missing required environment variable: ${envVar.name} (${
          envVar.keys.join(" or ")
        })`,
      );
    }
  }

  // Check optional but recommended variables
  const recommendedEnvVars = [
    {
      keys: ["WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164"],
      name: "WhatsApp Bot Number",
    },
  ];

  for (const envVar of recommendedEnvVars) {
    if (!getEnv(...envVar.keys)) {
      warnings.push(
        `Missing recommended environment variable: ${envVar.name} (${
          envVar.keys.join(" or ")
        })`,
      );
    }
  }

  // Validate numeric configurations
  const numericConfigs = [
    { key: "WA_RATE_LIMIT_WINDOW_MS", default: 60000, min: 1000, max: 3600000 },
    { key: "WA_RATE_LIMIT_MAX_REQUESTS", default: 100, min: 1, max: 10000 },
    { key: "WA_CACHE_DEFAULT_TTL", default: 300, min: 1, max: 86400 },
    { key: "WA_CACHE_MAX_SIZE", default: 1000, min: 10, max: 100000 },
    { key: "WA_WEBHOOK_MAX_BYTES", default: 262144, min: 1024, max: 10485760 },
  ];

  for (const config of numericConfigs) {
    const value = parseInt(Deno.env.get(config.key) || String(config.default));
    if (isNaN(value) || value < config.min || value > config.max) {
      warnings.push(
        `${config.key} is invalid or out of range [${config.min}, ${config.max}]. Using default: ${config.default}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get environment variable with fallback to multiple keys
 */
function getEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return undefined;
}

/**
 * Load configuration with defaults
 */
export function loadConfig(): EnvConfig {
  return {
    // WhatsApp
    waPhoneId: getEnv("WA_PHONE_ID", "WHATSAPP_PHONE_NUMBER_ID") || "",
    waToken: getEnv("WA_TOKEN", "WHATSAPP_ACCESS_TOKEN") || "",
    waAppSecret: getEnv("WA_APP_SECRET", "WHATSAPP_APP_SECRET") || "",
    waVerifyToken: getEnv("WA_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN") || "",
    waBotNumberE164:
      getEnv("WA_BOT_NUMBER_E164", "WHATSAPP_PHONE_NUMBER_E164") || "",

    // Supabase
    supabaseUrl: getEnv("SUPABASE_URL", "SERVICE_URL") || "",
    supabaseServiceRoleKey: getEnv(
      "WA_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SERVICE_ROLE_KEY",
    ) || "",
    supabaseAnonKey: getEnv("SUPABASE_ANON_KEY"),

    // Rate Limiting
    rateLimitWindowMs: parseInt(
      Deno.env.get("WA_RATE_LIMIT_WINDOW_MS") || "60000",
    ),
    rateLimitMaxRequests: parseInt(
      Deno.env.get("WA_RATE_LIMIT_MAX_REQUESTS") || "100",
    ),
    rateLimitBlacklistThreshold: parseInt(
      Deno.env.get("WA_RATE_LIMIT_BLACKLIST_THRESHOLD") || "10",
    ),

    // Caching
    cacheDefaultTTL: parseInt(Deno.env.get("WA_CACHE_DEFAULT_TTL") || "300"),
    cacheMaxSize: parseInt(Deno.env.get("WA_CACHE_MAX_SIZE") || "1000"),
    cacheCheckPeriod: parseInt(Deno.env.get("WA_CACHE_CHECK_PERIOD") || "600"),

    // Performance
    webhookMaxBytes: parseInt(Deno.env.get("WA_WEBHOOK_MAX_BYTES") || "262144"),
    httpTimeoutMs: parseInt(Deno.env.get("WA_HTTP_TIMEOUT_MS") || "10000"),
    httpMaxRetries: parseInt(Deno.env.get("WA_HTTP_MAX_RETRIES") || "1"),
    httpRetryDelayMs: parseInt(Deno.env.get("WA_HTTP_RETRY_DELAY_MS") || "200"),

    // Feature Flags
    enableRateLimiting: Deno.env.get("WA_ENABLE_RATE_LIMITING") !== "false",
    enableCaching: Deno.env.get("WA_ENABLE_CACHING") !== "false",
    enableUserErrorNotifications:
      Deno.env.get("WA_ENABLE_USER_ERROR_NOTIFICATIONS") === "true",

    // Environment
    environment: Deno.env.get("APP_ENV") || Deno.env.get("NODE_ENV") ||
      "production",
  };
}

/**
 * Print configuration status
 */
export function printConfigStatus(): void {
  const validation = validateAndLoadConfig();

  if (validation.errors.length > 0) {
    await logStructuredEvent("CONFIG_VALIDATION_ERRORS", {
      errors: validation.errors,
    }, "error");
  }

  if (validation.warnings.length > 0) {
    await logStructuredEvent("CONFIG_VALIDATION_WARNINGS", {
      warnings: validation.warnings,
    }, "warn");
  }

  if (validation.valid) {
    logStructuredEvent("CONFIG_VALIDATION_SUCCESS", {
      warningCount: validation.warnings.length,
    }, "info");
  }
}

/**
 * Assert configuration is valid (throws if not)
 */
export function assertConfigValid(): void {
  const validation = validateAndLoadConfig();

  if (!validation.valid) {
    throw new Error(
      `Configuration validation failed:\n${validation.errors.join("\n")}`,
    );
  }
}
