/**
 * Waiter AI Agent - Module exports
 *
 * This module provides the state machine, discovery tools, and session management
 * for the Waiter AI agent.
 */

// Types
export {
  WAITER_STATE_KEYS,
  WAITER_STATE_TRANSITIONS,
  createDefaultWaiterContext,
  type WaiterStateKey,
  type WaiterSessionContext,
  type WaiterState,
  type WaiterEntryMode,
  type BarInfo,
  type BarDiscoveryResult,
} from "./types.ts";

// Discovery tools
export {
  getBarsNearLocation,
  searchBarsByName,
  getBarInfo,
  barHasMenu,
  formatBarsForWhatsApp,
} from "./discovery-tools.ts";

// Session management
export {
  getWaiterState,
  setWaiterState,
  clearWaiterState,
  transitionWaiterState,
  initializeWaiterSession,
  initializeWaiterSessionFromQR,
  setWaiterVenue,
  setWaiterTableNumber,
  setWaiterLocation,
  requiresVenueDiscovery,
  isReadyForOrdering,
} from "./session-manager.ts";
