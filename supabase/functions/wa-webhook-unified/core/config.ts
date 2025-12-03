/**
 * Configuration for WA-Webhook-Unified
 * 
 * Feature flags and environment configuration for the unified AI agent service.
 */

export const CONFIG = {
  /**
   * Enable the unified AI agents architecture
   * When true, all agent functionality is handled by this service
   * Default: false (for gradual rollout)
   */
  UNIFIED_AI_AGENTS_ENABLED: Deno.env.get("UNIFIED_AI_AGENTS_ENABLED") === "true",

  /**
   * Default AI provider to use
   * Options: "gemini" | "openai"
   * Default: "gemini"
   */
  DEFAULT_AI_PROVIDER: (Deno.env.get("DEFAULT_AI_PROVIDER") ?? "gemini") as "gemini" | "openai",

  /**
   * Enable automatic fallback between AI providers
   * When true, if primary provider fails, automatically try secondary
   * Default: true
   */
  AI_FALLBACK_ENABLED: Deno.env.get("AI_FALLBACK_ENABLED") !== "false",

  /**
   * Service information
   */
  SERVICE: {
    NAME: "wa-webhook-unified",
    VERSION: "2.0.0",
    ARCHITECTURE: "consolidated-ai-agents",
  },

  /**
   * AI Provider information
   */
  AI_PROVIDERS: {
    PRIMARY: "gemini-2.5-pro",
    SECONDARY: "gpt-5",
  },

  /**
   * Session configuration
   */
  SESSION: {
    /** Context window duration in milliseconds (5 minutes) */
    CONTEXT_WINDOW_MS: 5 * 60 * 1000,
    /** Maximum conversation history entries to keep */
    MAX_HISTORY_ENTRIES: 10,
  },

  /**
   * Rate limiting configuration
   */
  RATE_LIMIT: {
    /** Max requests per window */
    LIMIT: 100,
    /** Window duration in seconds */
    WINDOW_SECONDS: 60,
  },
} as const;

/**
 * Get a feature flag value with type safety
 */
export function isFeatureEnabled(flag: keyof typeof CONFIG): boolean {
  const value = CONFIG[flag];
  return typeof value === "boolean" ? value : false;
}

/**
 * Get configuration for health endpoint response
 */
export function getHealthConfig() {
  return {
    service: CONFIG.SERVICE.NAME,
    version: CONFIG.SERVICE.VERSION,
    architecture: CONFIG.SERVICE.ARCHITECTURE,
    aiProviders: {
      primary: CONFIG.AI_PROVIDERS.PRIMARY,
      secondary: CONFIG.AI_PROVIDERS.SECONDARY,
      default: CONFIG.DEFAULT_AI_PROVIDER,
      fallbackEnabled: CONFIG.AI_FALLBACK_ENABLED,
    },
    features: {
      unifiedAiAgents: CONFIG.UNIFIED_AI_AGENTS_ENABLED,
    },
  };
}
