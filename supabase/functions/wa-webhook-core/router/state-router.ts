/**
 * State Router
 * Routes messages based on current user state
 */

import { SERVICES, STATE_KEYS } from "../../_shared/config/index.ts";
import type { RoutingDecision } from "./keyword-router.ts";

// ============================================================================
// STATE ROUTING MAP
// ============================================================================

const STATE_TO_SERVICE: Record<string, string> = {
  // Mobility states
  [STATE_KEYS.MOBILITY_MENU]: SERVICES.MOBILITY,
  [STATE_KEYS.MOBILITY_NEARBY_SELECT]: SERVICES.MOBILITY,
  [STATE_KEYS.MOBILITY_NEARBY_LOCATION]: SERVICES.MOBILITY,
  [STATE_KEYS.MOBILITY_NEARBY_RESULTS]: SERVICES.MOBILITY,
  [STATE_KEYS.SCHEDULE_ROLE]: SERVICES.MOBILITY,
  [STATE_KEYS.SCHEDULE_VEHICLE]: SERVICES.MOBILITY,
  [STATE_KEYS.SCHEDULE_LOCATION]: SERVICES.MOBILITY,
  [STATE_KEYS.SCHEDULE_DROPOFF]: SERVICES.MOBILITY,
  [STATE_KEYS.SCHEDULE_TIME]: SERVICES.MOBILITY,
  [STATE_KEYS.GO_ONLINE_PROMPT]: SERVICES.MOBILITY,
  [STATE_KEYS.TRIP_IN_PROGRESS]: SERVICES.MOBILITY,

  // Insurance states
  [STATE_KEYS.INSURANCE_MENU]: SERVICES.INSURANCE,
  [STATE_KEYS.INSURANCE_UPLOAD]: SERVICES.INSURANCE,
  [STATE_KEYS.CLAIM_TYPE]: SERVICES.INSURANCE,
  [STATE_KEYS.CLAIM_DESCRIPTION]: SERVICES.INSURANCE,
  [STATE_KEYS.CLAIM_DOCUMENTS]: SERVICES.INSURANCE,
  [STATE_KEYS.CLAIM_SUBMITTED]: SERVICES.INSURANCE,

  // Profile states
  [STATE_KEYS.PROFILE_EDIT_NAME]: SERVICES.PROFILE,
  [STATE_KEYS.PROFILE_EDIT_EMAIL]: SERVICES.PROFILE,
  [STATE_KEYS.PROFILE_EDIT_LANGUAGE]: SERVICES.PROFILE,
  [STATE_KEYS.WALLET_TRANSFER_RECIPIENT]: SERVICES.PROFILE,
  [STATE_KEYS.WALLET_TRANSFER_AMOUNT]: SERVICES.PROFILE,
  [STATE_KEYS.WALLET_TRANSFER_CONFIRM]: SERVICES.PROFILE,

  // Home state (handled by core)
  [STATE_KEYS.HOME]: SERVICES.CORE,
};

// ============================================================================
// STATE ROUTER
// ============================================================================

/**
 * Route message based on current user state
 */
export function routeByState(stateKey: string): RoutingDecision {
  // Direct lookup
  const directMatch = STATE_TO_SERVICE[stateKey];
  if (directMatch) {
    return {
      service: directMatch,
      reason: "state",
      confidence: 1.0,
    };
  }

  // Prefix matching for dynamic states
  if (stateKey.startsWith("mobility_") || stateKey.startsWith("trip_") || stateKey.startsWith("schedule_")) {
    return {
      service: SERVICES.MOBILITY,
      reason: "state",
      confidence: 0.9,
    };
  }

  if (stateKey.startsWith("ins_") || stateKey.startsWith("claim_") || stateKey.startsWith("insurance_")) {
    return {
      service: SERVICES.INSURANCE,
      reason: "state",
      confidence: 0.9,
    };
  }

  if (stateKey.startsWith("profile_") || stateKey.startsWith("wallet_") || stateKey.startsWith("business_")) {
    return {
      service: SERVICES.PROFILE,
      reason: "state",
      confidence: 0.9,
    };
  }

  // Unknown state - fallback to core
  return {
    service: SERVICES.CORE,
    reason: "fallback",
    confidence: 0.5,
  };
}
