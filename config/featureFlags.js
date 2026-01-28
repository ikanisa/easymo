"use strict";
/**
 * Feature flags configuration
 * Implements EasyMO Ground Rules feature flag requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFeatureFlags = void 0;
exports.ExternalDiscoveryBudgets = exports.ExternalDiscoveryFlags = void 0;
exports.isFeatureEnabled = isFeatureEnabled;
exports.getEnabledFeatures = getEnabledFeatures;
exports.logFeatureFlags = logFeatureFlags;
/**
 * AI Agent feature flags
 * All features default to OFF for safety
 */
exports.AgentFeatureFlags = {
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
};
/**
 * External discovery feature flags
 * All features default to OFF for safety
 */
exports.ExternalDiscoveryFlags = {
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
};
const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
/**
 * External discovery budgets (safety caps)
 */
exports.ExternalDiscoveryBudgets = {
    DISCOVERY_MAX_RESULTS: parsePositiveInt(process.env.DISCOVERY_MAX_RESULTS, 10),
    DISCOVERY_MAX_CALLS_PER_REQUEST: parsePositiveInt(process.env.DISCOVERY_MAX_CALLS_PER_REQUEST, 2),
    MAPS_MAX_CALLS_PER_REQUEST: parsePositiveInt(process.env.MAPS_MAX_CALLS_PER_REQUEST, 2),
};
/**
 * Check if a feature is enabled
 */
function isFeatureEnabled(feature) {
    return exports.AgentFeatureFlags[feature];
}
/**
 * Get all enabled features
 */
function getEnabledFeatures() {
    return Object.entries(exports.AgentFeatureFlags)
        .filter(([_, enabled]) => enabled)
        .map(([feature]) => feature);
}
/**
 * Log feature flag status (for debugging)
 */
function logFeatureFlags() {
    console.log("Feature flags status:", {
        enabled: getEnabledFeatures(),
        all: exports.AgentFeatureFlags,
    });
}
