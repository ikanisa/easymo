/**
 * Feature Flags for wa-webhook-unified
 * 
 * Controls gradual rollout of consolidated domains
 */

export interface FeatureFlags {
  unifiedRolloutPercent: number;
  enableUnifiedJobs: boolean;
  jobsRolloutPercent: number;
  enableUnifiedMarketplace: boolean;
  marketplaceRolloutPercent: number;
  enableUnifiedProperty: boolean;
  propertyRolloutPercent: number;
}

export function loadFeatureFlags(): FeatureFlags {
  return {
    unifiedRolloutPercent: parseInt(Deno.env.get('UNIFIED_ROLLOUT_PERCENT') || '0', 10),
    enableUnifiedJobs: Deno.env.get('ENABLE_UNIFIED_JOBS') === 'true',
    jobsRolloutPercent: parseInt(Deno.env.get('JOBS_ROLLOUT_PERCENT') || '0', 10),
    enableUnifiedMarketplace: Deno.env.get('ENABLE_UNIFIED_MARKETPLACE') === 'true',
    marketplaceRolloutPercent: parseInt(Deno.env.get('MARKETPLACE_ROLLOUT_PERCENT') || '0', 10),
    enableUnifiedProperty: Deno.env.get('ENABLE_UNIFIED_PROPERTY') === 'true',
    propertyRolloutPercent: parseInt(Deno.env.get('PROPERTY_ROLLOUT_PERCENT') || '0', 10),
  };
}

export function shouldUseUnified(phoneNumber: string, rolloutPercent: number): boolean {
  if (rolloutPercent === 0) return false;
  if (rolloutPercent >= 100) return true;
  
  const hash = simpleHash(phoneNumber);
  const bucket = hash % 100;
  return bucket < rolloutPercent;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
