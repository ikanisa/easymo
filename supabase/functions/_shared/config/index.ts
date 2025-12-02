/**
 * Configuration Module Exports
 */

export { getEnv, validateEnv, envLoader } from "./env.ts";
export type { Environment, EnvConfig } from "./env.ts";

export {
  SERVICES,
  WA_IDS,
  STATE_KEYS,
  VEHICLE_TYPES,
  TRIP_STATUS,
  CLAIM_TYPES,
  CLAIM_STATUS,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LIMITS,
  TIMEOUTS,
  PATTERNS,
} from "./constants.ts";

export type {
  ServiceName,
  WaId,
  StateKey,
  VehicleType,
  TripStatus,
  ClaimType,
  ClaimStatus,
  Language,
} from "./constants.ts";
