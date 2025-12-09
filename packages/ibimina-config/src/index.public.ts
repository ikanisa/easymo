// Public API surface for @ibimina/config
export { env, clientEnv, requiredServerEnv, atLeastOneServerEnv, loadServerEnv } from "./env";
export type { ServerEnv, ClientEnv, RequiredServerEnvGroups, RawEnv } from "./env";
export {
  featureFlagDefinitions,
  getTenantFeatureFlags,
  isFeatureEnabledForTenant,
  isPilotTenant,
  normalizeTenantId,
  PILOT_DISTRICT,
  PILOT_TENANT_IDS,
  PILOT_TENANTS,
} from "./featureFlags";
export type {
  FeatureFlagName,
  PilotDistrict,
  PilotTenant,
  TenantFeatureFlag,
  TenantFeatureFlags,
} from "./featureFlags";
export { ussdConfig, getDefaultUssdOperator, getUssdOperatorById } from "./ussd";
export type { UssdConfig, UssdOperatorConfig, UssdLocaleDefinition } from "./ussd";
