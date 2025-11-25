/**
 * Feature Flags Configuration
 * 
 * Controls gradual rollout of unified service.
 * Enables A/B testing and quick rollback.
 */

export interface FeatureFlags {
  // Main feature flag
  unifiedServiceEnabled: boolean;
  unifiedServiceRolloutPercent: number; // 0-100
  
  // Per-agent flags
  agentFlags: {
    marketplace: boolean;
    jobs: boolean;
    property: boolean;
    farmer: boolean;
    waiter: boolean;
    insurance: boolean;
    rides: boolean;
    sales: boolean;
    business_broker: boolean;
    support: boolean;
  };
  
  // Feature-specific flags
  features: {
    crossDomainHandoffs: boolean;
    unifiedSearch: boolean;
    sharedPreferences: boolean;
    hybridFlows: boolean;
  };
}

/**
 * Get feature flags from database or environment
 */
export async function getFeatureFlags(supabase: any): Promise<FeatureFlags> {
  // Try to get from database first
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "unified_service_flags")
    .single();

  if (data?.value) {
    return data.value as FeatureFlags;
  }

  // Fallback to environment variables
  const rolloutPercent = parseInt(
    Deno.env.get("UNIFIED_SERVICE_ROLLOUT_PERCENT") || "0"
  );

  return {
    unifiedServiceEnabled: Deno.env.get("UNIFIED_SERVICE_ENABLED") === "true",
    unifiedServiceRolloutPercent: rolloutPercent,
    agentFlags: {
      marketplace: true,
      jobs: true,
      property: true,
      farmer: true,
      waiter: true,
      insurance: true,
      rides: true,
      sales: true,
      business_broker: true,
      support: true,
    },
    features: {
      crossDomainHandoffs: rolloutPercent >= 50,
      unifiedSearch: rolloutPercent >= 75,
      sharedPreferences: rolloutPercent >= 25,
      hybridFlows: rolloutPercent >= 10,
    },
  };
}

/**
 * Check if user should use unified service
 * Uses consistent hashing for stable rollout
 */
export function shouldUseUnifiedService(
  userPhone: string,
  rolloutPercent: number
): boolean {
  if (rolloutPercent === 0) return false;
  if (rolloutPercent === 100) return true;

  // Use simple hash for consistent assignment
  const hash = hashString(userPhone);
  const bucket = hash % 100;
  return bucket < rolloutPercent;
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Update feature flags in database
 */
export async function updateFeatureFlags(
  supabase: any,
  flags: Partial<FeatureFlags>
): Promise<void> {
  const { data: existing } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "unified_service_flags")
    .single();

  const updated = { ...existing?.value, ...flags };

  await supabase
    .from("app_config")
    .upsert({
      key: "unified_service_flags",
      value: updated,
      updated_at: new Date().toISOString(),
    });
}
