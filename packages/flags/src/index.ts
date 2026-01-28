/**
 * @easymo/flags - Feature flags for the EasyMO platform
 * 
 * Feature flags allow enabling/disabling features at runtime.
 * All new features MUST be gated behind feature flags that default to OFF in production.
 * 
 * See: docs/GROUND_RULES.md for feature flag requirements.
 */

import { z } from 'zod';

/**
 * Feature flag schema
 */
export const FeatureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean().default(false),
  description: z.string().optional(),
  environments: z.array(z.enum(['development', 'staging', 'production'])).optional(),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

/**
 * Feature flag keys - add new features here
 */
export const FEATURE_FLAGS = {
  // Vendor/SACCO features
  VENDOR_PORTAL: 'vendor_portal',
  SACCO_RECONCILIATION: 'sacco_reconciliation',
  IKIMINA_MANAGEMENT: 'ikimina_management',

  // MomoTerminal features
  MOMO_TERMINAL_ADMIN: 'momo_terminal_admin',
  MOMO_TERMINAL_SMS_WEBHOOK: 'momo_terminal_sms_webhook',
  MOMO_TERMINAL_NFC: 'momo_terminal_nfc',

  // Admin features
  AI_AGENTS_ADMIN: 'ai_agents_admin',
  WHATSAPP_ADMIN: 'whatsapp_admin',

  // Marketplace
  MARKETPLACE: 'marketplace',

  // Voice/Video
  VOICE_CALLS: 'voice_calls',
  VIDEO_CALLS: 'video_calls',

  // Real Estate
  REAL_ESTATE_PWA: 'real_estate_pwa',

  // AI Concierge Kill Switches (instant fallback to coded workflows)
  AI_CONCIERGE: 'ai_concierge',                    // Master "brain" toggle
  AI_CONCIERGE_CALLING: 'ai_concierge_calling',    // Voice call toggle
  AI_CONCIERGE_OCR: 'ai_concierge_ocr',            // OCR pipeline toggle
} as const;

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

/**
 * Default feature flag values for each environment
 */
const defaultFlags: Record<string, boolean> = {
  // Most features default to OFF in production
  [FEATURE_FLAGS.VENDOR_PORTAL]: false,
  [FEATURE_FLAGS.SACCO_RECONCILIATION]: false,
  [FEATURE_FLAGS.IKIMINA_MANAGEMENT]: false,
  [FEATURE_FLAGS.MOMO_TERMINAL_ADMIN]: false,
  [FEATURE_FLAGS.MOMO_TERMINAL_SMS_WEBHOOK]: false,
  [FEATURE_FLAGS.MOMO_TERMINAL_NFC]: false,
  [FEATURE_FLAGS.AI_AGENTS_ADMIN]: true, // Existing feature
  [FEATURE_FLAGS.WHATSAPP_ADMIN]: true, // Existing feature
  [FEATURE_FLAGS.MARKETPLACE]: false,
  [FEATURE_FLAGS.VOICE_CALLS]: false,
  [FEATURE_FLAGS.VIDEO_CALLS]: false,
  [FEATURE_FLAGS.REAL_ESTATE_PWA]: false,
  // AI Concierge kill switches (default OFF = use coded workflows)
  [FEATURE_FLAGS.AI_CONCIERGE]: false,
  [FEATURE_FLAGS.AI_CONCIERGE_CALLING]: false,
  [FEATURE_FLAGS.AI_CONCIERGE_OCR]: false,
};

/**
 * Check if a feature is enabled
 * 
 * @param flag - The feature flag key
 * @returns true if the feature is enabled
 * 
 * @example
 * ```typescript
 * import { isFeatureEnabled, FEATURE_FLAGS } from '@easymo/flags';
 * 
 * if (isFeatureEnabled(FEATURE_FLAGS.VENDOR_PORTAL)) {
 *   // Vendor portal feature code
 * }
 * ```
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  // Check environment variable first (FEATURE_<FLAG_NAME>=true)
  // Transform flag to valid env var name: uppercase and replace non-alphanumeric with underscore
  const envKey = `FEATURE_${flag.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const envValue = typeof process !== 'undefined'
    ? process.env?.[envKey]
    : undefined;

  if (envValue !== undefined) {
    return envValue === 'true';
  }

  // Fall back to default
  return defaultFlags[flag] ?? false;
}

/**
 * Get all feature flags with their current status
 * 
 * @returns Record of all feature flags and their enabled status
 */
export function getAllFlags(): Record<FeatureFlagKey, boolean> {
  const result: Record<string, boolean> = {};

  for (const [, flag] of Object.entries(FEATURE_FLAGS)) {
    result[flag] = isFeatureEnabled(flag);
  }

  return result as Record<FeatureFlagKey, boolean>;
}

/**
 * Guard function for feature flags
 * Throws an error if the feature is not enabled
 * 
 * @param flag - The feature flag key
 * @param message - Optional custom error message
 */
export function requireFeature(flag: FeatureFlagKey, message?: string): void {
  if (!isFeatureEnabled(flag)) {
    throw new Error(message ?? `Feature '${flag}' is not enabled`);
  }
}
