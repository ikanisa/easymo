const BOOLEAN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const coalesceEnv = (keys: string[], defaultValue?: string) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) {
      return value;
    }
  }
  return defaultValue;
};

const readBooleanEnv = (keys: string[], defaultValue = false) => {
  const raw = coalesceEnv(keys);
  if (raw === undefined) return defaultValue;
  return BOOLEAN_TRUE_VALUES.has(raw.trim().toLowerCase());
};

export type StranglerFeatureFlag = "adminPwa" | "routerFunctions" | "modularApis";

export interface StranglerFeatureConfig {
  adminPwa: boolean;
  routerFunctions: boolean;
  modularApis: boolean;
}

export interface StranglerEndpointConfig {
  adminPwaBaseUrl?: string;
  routerFunctionsBaseUrl?: string;
  modularApisBaseUrl?: string;
}

export interface StranglerConfig {
  features: StranglerFeatureConfig;
  endpoints: StranglerEndpointConfig;
}

/**
 * Feature flag placeholders that prefer the new strangler-specific keys while
 * falling back to the existing environment variables.
 */
export const featureFlags: StranglerFeatureConfig = {
  adminPwa: readBooleanEnv([
    "FEATURE_ADMIN_PWA",
    "VITE_FEATURE_ADMIN_PWA",
    "NEXT_PUBLIC_ADMIN_PWA_ENABLED",
    "ADMIN_APP_PWA_ENABLED"
  ]),
  routerFunctions: readBooleanEnv([
    "FEATURE_ROUTER_FUNCTIONS",
    "VITE_FEATURE_ROUTER_FUNCTIONS",
    "ROUTER_FUNCTIONS_ENABLED",
    "API_ROUTER_FALLBACK"
  ]),
  modularApis: readBooleanEnv([
    "FEATURE_APP_APIS",
    "VITE_FEATURE_APP_APIS",
    "APP_APIS_ENABLED",
    "NEXT_PUBLIC_APP_APIS_ENABLED"
  ]),
};

/**
 * Endpoint placeholders keep references to the legacy URLs so the new code can
 * proxy traffic until the strangler cutover is complete.
 */
export const endpoints: StranglerEndpointConfig = {
  adminPwaBaseUrl: coalesceEnv([
    "STRANGLER_ADMIN_PWA_BASE_URL",
    "NEXT_PUBLIC_APP_URL",
    "ADMIN_APP_URL"
  ]),
  routerFunctionsBaseUrl: coalesceEnv([
    "STRANGLER_ROUTER_FN_URL",
    "ROUTER_SERVICE_URL",
    "API_BASE_URL"
  ]),
  modularApisBaseUrl: coalesceEnv([
    "STRANGLER_APP_APIS_URL",
    "NEXT_PUBLIC_API_URL",
    "APP_API_URL"
  ]),
};

export const stranglerConfig: StranglerConfig = {
  features: featureFlags,
  endpoints,
};

export const isStranglerFeatureEnabled = (flag: StranglerFeatureFlag) =>
  stranglerConfig.features[flag];

export type { StranglerConfig as ConfigShape };
