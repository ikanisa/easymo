"use strict";
/**
 * Feature flags configuration
 * Implements EasyMO Ground Rules feature flag requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFeatureFlags = void 0;
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
