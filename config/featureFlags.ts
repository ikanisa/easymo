/**
 * Feature flags configuration
 * Implements EasyMO Ground Rules feature flag requirements
 */

/**
 * AI Agent feature flags
 * All features default to OFF for safety
 */
export const AgentFeatureFlags = {
  /**
   * Enable AI agent chat via WhatsApp
   */
  ENABLE_AGENT_CHAT: process.env.FEATURE_AGENT_CHAT === "true" || 
                     process.env.FEATURE_AGENT_CHAT === "1",

  /**
   * Enable AI agent voice calls via Realtime API
   */
  ENABLE_AGENT_VOICE: process.env.FEATURE_AGENT_VOICE === "true" ||
                      process.env.FEATURE_AGENT_VOICE === "1",

  /**
   * Enable customer lookup via AI agent
   */
  ENABLE_AGENT_CUSTOMER_LOOKUP: process.env.FEATURE_AGENT_CUSTOMER_LOOKUP === "true" ||
                                process.env.FEATURE_AGENT_CUSTOMER_LOOKUP === "1",

  /**
   * Enable OpenTelemetry tracing
   */
  ENABLE_OTEL_TRACING: process.env.ENABLE_OTEL_TRACING === "true" ||
                       process.env.ENABLE_OTEL_TRACING === "1",

  /**
   * Enable cost tracking dashboard
   */
  ENABLE_COST_DASHBOARD: process.env.ENABLE_COST_DASHBOARD === "true" ||
                         process.env.ENABLE_COST_DASHBOARD === "1",
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof AgentFeatureFlags): boolean {
  return AgentFeatureFlags[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(AgentFeatureFlags)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Log feature flag status (for debugging)
 */
export function logFeatureFlags(): void {
  console.log("Feature flags status:", {
    enabled: getEnabledFeatures(),
    all: AgentFeatureFlags,
  });
}
