/**
 * Centralized Webhook Configuration
 * 
 * All webhook rate limits, body sizes, and other config in one place.
 * Environment variables can override defaults.
 */

interface WebhookConfig {
  rateLimit: number;
  rateWindow: number;
  maxBodySize: number;
}

const getEnvInt = (key: string, defaultValue: number): number => {
  const value = Deno.env.get(key);
  return value ? parseInt(value, 10) : defaultValue;
};

export const WEBHOOK_CONFIG = {
  mobility: {
    rateLimit: getEnvInt("MOBILITY_RATE_LIMIT", 100),
    rateWindow: getEnvInt("MOBILITY_RATE_WINDOW", 60),
    maxBodySize: getEnvInt("MOBILITY_MAX_BODY", 1024 * 1024), // 1MB
  },
  insurance: {
    rateLimit: getEnvInt("INSURANCE_RATE_LIMIT", 100),
    rateWindow: getEnvInt("INSURANCE_RATE_WINDOW", 60),
    maxBodySize: getEnvInt("INSURANCE_MAX_BODY", 2 * 1024 * 1024), // 2MB for uploads
  },
  profile: {
    rateLimit: getEnvInt("PROFILE_RATE_LIMIT", 100),
    rateWindow: getEnvInt("PROFILE_RATE_WINDOW", 60),
    maxBodySize: getEnvInt("PROFILE_MAX_BODY", 2 * 1024 * 1024), // 2MB for photos
  },
  wallet: {
    rateLimit: getEnvInt("WALLET_RATE_LIMIT", 100),
    rateWindow: getEnvInt("WALLET_RATE_WINDOW", 60),
    maxBodySize: getEnvInt("WALLET_MAX_BODY", 1024 * 1024), // 1MB
  },
  core: {
    rateLimit: getEnvInt("CORE_RATE_LIMIT", 100),
    rateWindow: getEnvInt("CORE_RATE_WINDOW", 60),
    maxBodySize: getEnvInt("CORE_MAX_BODY", 2 * 1024 * 1024), // 2MB
  },
} as const;

export type WebhookName = keyof typeof WEBHOOK_CONFIG;

/**
 * Get configuration for a specific webhook
 */
export function getWebhookConfig(name: WebhookName): WebhookConfig {
  return WEBHOOK_CONFIG[name];
}
