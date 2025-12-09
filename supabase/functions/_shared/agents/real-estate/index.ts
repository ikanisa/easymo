/**
 * Real Estate AI Agent - Module exports
 */

// Types
export {
  REAL_ESTATE_STATE_KEYS,
  REAL_ESTATE_STATE_TRANSITIONS,
  ROLE_LABELS,
  createDefaultRealEstateContext,
  type RealEstateRole,
  type RealEstateStateKey,
  type RealEstateSessionContext,
  type RealEstateState,
  type RealEstateLead,
} from "./types.ts";

// Role handshake
export {
  getRealEstateState,
  setRealEstateState,
  clearRealEstateState,
  initializeRoleSelection,
  setUserRole,
  requiresRoleHandshake,
  formatRoleSelectionMessage,
  parseRoleFromButtonId,
} from "./role-handshake.ts";
