/**
 * Feature flag utilities for agents package
 * 
 * All agent functionality is gated behind feature flags
 * that default to OFF in production.
 */

/**
 * Agent feature flags
 */
export type AgentFeatureFlag =
  | 'agents.booking'
  | 'agents.redemption'
  | 'agents.savings'
  | 'agents.triage'
  | 'agents.websearch';

/**
 * Default feature flag states (all OFF by default)
 */
const DEFAULT_FLAGS: Record<AgentFeatureFlag, boolean> = {
  'agents.booking': false,
  'agents.redemption': false,
  'agents.savings': false,
  'agents.triage': false,
  'agents.websearch': false,
};

/**
 * Check if an agent feature is enabled
 */
export function isAgentFeatureEnabled(flag: AgentFeatureFlag): boolean {
  const envKey = `FEATURE_${flag.toUpperCase().replace(/\./g, '_')}`;
  const envValue = process.env[envKey];

  if (envValue === undefined) {
    return DEFAULT_FLAGS[flag];
  }

  return ['1', 'true', 'yes', 'on'].includes(envValue.toLowerCase());
}

/**
 * Require a feature to be enabled, throw error if not
 */
export function requireAgentFeature(flag: AgentFeatureFlag): void {
  if (!isAgentFeatureEnabled(flag)) {
    throw new Error(`Feature ${flag} is not enabled`);
  }
}
