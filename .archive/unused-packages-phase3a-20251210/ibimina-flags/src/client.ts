import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FeatureFlagContext,
  FeatureFlagEntry,
  FeatureFlagKey,
  FeatureFlagMap,
} from "./types";

const DEFAULT_KEYS: FeatureFlagKey[] = [
  "ai_agent",
  "ussd_copy_first",
  "offers_marketplace",
  "statements_insights",
  "group_join_requests",
];

type RpcParams = {
  feature_key: string;
  check_country_id: string | null;
  check_org_id: string | null;
};

const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return false;
};

export const fetchFeatureFlags = async (
  client: SupabaseClient,
  keys: FeatureFlagKey[] = DEFAULT_KEYS,
  context: FeatureFlagContext = {}
): Promise<FeatureFlagEntry[]> => {
  if (!keys.length) {
    return [];
  }

  const results = await Promise.all(
    keys.map(async (key) => {
      const params: RpcParams = {
        feature_key: key,
        check_country_id: context.countryId ?? null,
        check_org_id: context.orgId ?? null,
      };

      const { data, error } = await client.rpc("is_feature_enabled", params);

      if (error) {
        throw error;
      }

      return {
        key,
        enabled: coerceBoolean(data),
      } satisfies FeatureFlagEntry;
    })
  );

  return results;
};

export const fetchFeatureFlagMap = async (
  client: SupabaseClient,
  keys: FeatureFlagKey[] = DEFAULT_KEYS,
  context: FeatureFlagContext = {}
): Promise<FeatureFlagMap> => {
  const entries = await fetchFeatureFlags(client, keys, context);
  return entries.reduce<FeatureFlagMap>((acc, entry) => {
    acc[entry.key] = entry;
    return acc;
  }, {});
};

export const DEFAULT_FEATURE_FLAG_KEYS = DEFAULT_KEYS;
