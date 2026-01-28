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
 * External discovery feature flags
 * All features default to OFF for safety
 */
export const ExternalDiscoveryFlags = {
  /**
   * Enable external vendor discovery (web search, maps, social)
   */
  EXTERNAL_DISCOVERY_ENABLED: process.env.EXTERNAL_DISCOVERY_ENABLED === "true" ||
                              process.env.EXTERNAL_DISCOVERY_ENABLED === "1",

  /**
   * Enable Google Maps Places enrichment
   */
  MAPS_ENRICHMENT_ENABLED: process.env.MAPS_ENRICHMENT_ENABLED === "true" ||
                           process.env.MAPS_ENRICHMENT_ENABLED === "1",

  /**
   * Enable social discovery (official APIs only)
   */
  SOCIAL_DISCOVERY_ENABLED: process.env.SOCIAL_DISCOVERY_ENABLED === "true" ||
                            process.env.SOCIAL_DISCOVERY_ENABLED === "1",
} as const;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * External discovery budgets (safety caps)
 */
export const ExternalDiscoveryBudgets = {
  DISCOVERY_MAX_RESULTS: parsePositiveInt(process.env.DISCOVERY_MAX_RESULTS, 10),
  DISCOVERY_MAX_CALLS_PER_REQUEST: parsePositiveInt(process.env.DISCOVERY_MAX_CALLS_PER_REQUEST, 2),
  MAPS_MAX_CALLS_PER_REQUEST: parsePositiveInt(process.env.MAPS_MAX_CALLS_PER_REQUEST, 2),
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
