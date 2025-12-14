/**
 * Feature Flags Service with Database Support
 * 
 * Provides safe feature rollout with percentage-based gradual deployment.
 * Supports per-user bucketing for consistent experience.
 * 
 * Phase 6 Implementation
 * 
 * @module feature-flags-db
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rollout_percentage: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// In-memory cache with 5-minute TTL
const flagCache = new Map<string, { flag: FeatureFlag; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a feature is enabled for a user
 * 
 * @param supabase - Supabase client
 * @param flagName - Name of the feature flag
 * @param userId - Optional user ID for percentage rollout
 * @returns True if feature is enabled for this user
 */
export async function isEnabled(
  supabase: SupabaseClient,
  flagName: string,
  userId?: string
): Promise<boolean> {
  // Check cache first
  const cached = flagCache.get(flagName);
  if (cached && cached.expiresAt > Date.now()) {
    return rolloutDecision(cached.flag, userId);
  }

  // Fetch from database
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("name", flagName)
    .single();

  if (error || !data) {
    // Default to disabled if flag not found
    return false;
  }

  // Cache for 5 minutes
  flagCache.set(flagName, {
    flag: data as FeatureFlag,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return rolloutDecision(data as FeatureFlag, userId);
}

/**
 * Check multiple flags at once (more efficient)
 */
export async function isEnabledBulk(
  supabase: SupabaseClient,
  flagNames: string[],
  userId?: string
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  const uncachedFlags: string[] = [];

  // Check cache
  for (const flagName of flagNames) {
    const cached = flagCache.get(flagName);
    if (cached && cached.expiresAt > Date.now()) {
      result[flagName] = rolloutDecision(cached.flag, userId);
    } else {
      uncachedFlags.push(flagName);
    }
  }

  // Fetch uncached
  if (uncachedFlags.length > 0) {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("*")
      .in("name", uncachedFlags);

    if (!error && data) {
      for (const flag of data as FeatureFlag[]) {
        flagCache.set(flag.name, {
          flag,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        result[flag.name] = rolloutDecision(flag, userId);
      }
    }

    // Default missing to false
    for (const flagName of uncachedFlags) {
      if (!(flagName in result)) {
        result[flagName] = false;
      }
    }
  }

  return result;
}

/**
 * Determine if feature should be enabled based on rollout percentage
 */
function rolloutDecision(flag: FeatureFlag, userId?: string): boolean {
  if (!flag.enabled) return false;
  if (flag.rollout_percentage === 0) return false;
  if (flag.rollout_percentage === 100) return true;
  if (!userId) return false;

  const bucket = hashUserIdToBucket(userId, flag.name);
  return bucket < flag.rollout_percentage;
}

/**
 * Hash user ID to consistent bucket (0-99)
 */
function hashUserIdToBucket(userId: string, flagName: string): number {
  const input = `${userId}:${flagName}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}

/**
 * Clear cache
 */
export function clearCache(flagName?: string): void {
  if (flagName) {
    flagCache.delete(flagName);
  } else {
    flagCache.clear();
  }
}
