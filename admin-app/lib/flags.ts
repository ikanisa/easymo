import { useMemo } from "react";

const TRUTHY_VALUES = new Set(["1", "true", "on", "yes", "enabled"]);
const FALSY_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

export type FeatureFlagName = "adminHubV2";

const FEATURE_FLAG_SOURCES: Record<FeatureFlagName, string | undefined> = {
  adminHubV2:
    process.env.NEXT_PUBLIC_FLAG_ADMIN_HUB_V2 ??
    process.env.FLAG_ADMIN_HUB_V2 ??
    process.env.NEXT_PUBLIC_ADMIN_HUB_V2 ??
    process.env.ADMIN_HUB_V2,
};

type FeatureFlagOverrides = Partial<Record<FeatureFlagName, boolean>>;

const GLOBAL_FLAG_KEY = "__EASYMO_FEATURE_FLAGS__" as const;

function readOverrides(): FeatureFlagOverrides | undefined {
  if (typeof globalThis === "undefined") {
    return undefined;
  }

  return (globalThis as typeof globalThis & {
    [GLOBAL_FLAG_KEY]?: FeatureFlagOverrides;
  })[GLOBAL_FLAG_KEY];
}

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }

  if (FALSY_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

export function isFeatureFlagEnabled(
  flag: FeatureFlagName,
  defaultValue = false,
): boolean {
  const overrides = readOverrides();

  if (overrides && typeof overrides[flag] === "boolean") {
    return overrides[flag] as boolean;
  }

  return parseFlag(FEATURE_FLAG_SOURCES[flag], defaultValue);
}

export function getFeatureFlags(defaultValue = false): Record<FeatureFlagName, boolean> {
  return {
    adminHubV2: isFeatureFlagEnabled("adminHubV2", defaultValue),
  };
}

export function useFeatureFlag(flag: FeatureFlagName, defaultValue = false): boolean {
  return useMemo(() => isFeatureFlagEnabled(flag, defaultValue), [flag, defaultValue]);
}

