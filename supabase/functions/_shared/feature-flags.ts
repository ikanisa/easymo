/**
 * Feature Flags for Supabase Edge Functions
 * 
 * Provides feature flag checking to control feature rollout.
 * Flags are controlled via environment variables.
 * 
 * @see docs/GROUND_RULES.md for usage guidelines
 */

/**
 * Available feature flags across the platform
 * 
 * Add new flags here and in packages/commons/src/feature-flags.ts
 */
export type FeatureFlag =
  | "agent.chat"
  | "agent.webSearch"
  | "agent.collectPayment"
  | "agent.warmTransfer"
  | "agent.negotiation"
  | "agent.scheduling"
  | "wallet.service"
  | "ocr.processor"
  | "cart.reminders"
  | "deeplink.resolver";

/**
 * Default flag states (conservative - most features OFF by default)
 * 
 * Override via environment variables:
 * FEATURE_AGENT_CHAT=true
 * FEATURE_WALLET_SERVICE=true
 */
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  "agent.chat": true,
  "agent.webSearch": false,
  "agent.collectPayment": false,
  "agent.warmTransfer": false,
  "agent.negotiation": false,
  "agent.scheduling": false,
  "wallet.service": false,
  "ocr.processor": true,
  "cart.reminders": true,
  "deeplink.resolver": true,
};

/**
 * Convert feature flag name to environment variable name
 * 
 * @example
 * "agent.chat" -> "FEATURE_AGENT_CHAT"
 */
function flagToEnvKey(flag: FeatureFlag): string {
  return `FEATURE_${flag.replace(/\./g, "_").toUpperCase()}`;
}

/**
 * Get feature flag value from environment
 */
function getEnvFlag(flag: FeatureFlag): boolean | undefined {
  const key = flagToEnvKey(flag);
  const value = Deno.env.get(key);
  
  if (!value) return undefined;
  
  const normalized = value.toLowerCase().trim();
  return ["1", "true", "yes", "on"].includes(normalized);
}

/**
 * Check if a feature flag is enabled
 * 
 * Priority:
 * 1. Environment variable (FEATURE_*)
 * 2. Consolidated flag for agent.* features (FEATURE_AGENT_ALL)
 * 3. Default value
 * 
 * @param flag - Feature flag to check
 * @returns true if feature is enabled
 * 
 * @example
 * if (isFeatureEnabled("wallet.service")) {
 *   await processPayment();
 * }
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envValue = getEnvFlag(flag);
  if (envValue !== undefined) return envValue;
  
  // Check for consolidated agent flag
  if (flag.startsWith("agent.")) {
    const agentAllValue = Deno.env.get("FEATURE_AGENT_ALL");
    if (agentAllValue) {
      const normalized = agentAllValue.toLowerCase().trim();
      if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
      }
    }
  }
  
  return DEFAULT_FLAGS[flag] ?? false;
}

/**
 * Require feature flag or throw error
 * 
 * @param flag - Feature flag to check
 * @throws Error if feature is disabled
 * 
 * @example
 * requireFeatureFlag("agent.chat");
 * // Continues if enabled, throws if disabled
 */
export function requireFeatureFlag(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) {
    throw new Error(`Feature flag ${flag} is not enabled`);
  }
}

/**
 * Get all feature flag states (for debugging/admin endpoints)
 * 
 * @returns Object with all flags and their current states
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags: Record<string, boolean> = {};
  
  for (const flag of Object.keys(DEFAULT_FLAGS) as FeatureFlag[]) {
    flags[flag] = isFeatureEnabled(flag);
  }
  
  return flags as Record<FeatureFlag, boolean>;
}
