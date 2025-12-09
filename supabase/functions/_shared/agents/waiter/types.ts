/**
 * Waiter AI Agent Types
 *
 * Defines explicit state machine for the Waiter AI agent.
 * Addresses W1: No explicit "bar context" state machine
 *
 * States:
 * - NO_VENUE_SELECTED: User has opened Waiter from home, no bar context
 * - DISCOVERY_MODE: User is browsing/searching for bars
 * - VENUE_SELECTED_NO_TABLE: Bar is selected but no table number
 * - VENUE_AND_TABLE_SELECTED: Full context available, ready to order
 */

/**
 * Waiter session mode - how the user entered the Waiter agent
 */
export type WaiterEntryMode = "qr" | "home" | "deep_link" | "discovery";

/**
 * Waiter state keys
 */
export const WAITER_STATE_KEYS = {
  /** User opened Waiter from home, no venue selected yet */
  NO_VENUE_SELECTED: "waiter_no_venue",
  /** User is searching/browsing for bars */
  DISCOVERY_MODE: "waiter_discovery",
  /** Bar selected, waiting for table number */
  VENUE_SELECTED_NO_TABLE: "waiter_venue_no_table",
  /** Full context: bar + table, ready to order */
  VENUE_AND_TABLE_SELECTED: "waiter_ready",
  /** User is ordering - has cart items */
  ORDERING: "waiter_ordering",
  /** Order placed, pending payment */
  PENDING_PAYMENT: "waiter_pending_payment",
  /** Awaiting location share for bar discovery */
  AWAITING_LOCATION: "waiter_awaiting_location",
  /** Searching for bar by name */
  SEARCHING_BAR_NAME: "waiter_searching_bar",
} as const;

export type WaiterStateKey = (typeof WAITER_STATE_KEYS)[keyof typeof WAITER_STATE_KEYS];

/**
 * Waiter session context - stored in user_state.data
 */
export interface WaiterSessionContext {
  /** How the user entered the Waiter agent */
  entryMode: WaiterEntryMode;
  /** Selected venue/bar ID */
  venueId: string | null;
  /** Venue name (for display) */
  venueName: string | null;
  /** Table number (from QR or user input) */
  tableNumber: string | null;
  /** Last known user location */
  lastLocation: {
    lat: number;
    lng: number;
    capturedAt: string;
  } | null;
  /** Current cart items (summary) */
  cartItemCount: number;
  /** Current cart total */
  cartTotal: number;
  /** Currency for the venue */
  currency: string;
  /** Conversation session ID for waiter_conversations table */
  conversationSessionId: string | null;
}

/**
 * Waiter state with typed data
 */
export interface WaiterState {
  key: WaiterStateKey;
  data: WaiterSessionContext;
  createdAt?: string;
  expiresAt?: string;
}

/**
 * Allowed state transitions for Waiter agent
 */
export const WAITER_STATE_TRANSITIONS: Record<WaiterStateKey, WaiterStateKey[]> = {
  [WAITER_STATE_KEYS.NO_VENUE_SELECTED]: [
    WAITER_STATE_KEYS.DISCOVERY_MODE,
    WAITER_STATE_KEYS.AWAITING_LOCATION,
    WAITER_STATE_KEYS.SEARCHING_BAR_NAME,
    WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE,
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
  ],
  [WAITER_STATE_KEYS.DISCOVERY_MODE]: [
    WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE,
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    WAITER_STATE_KEYS.AWAITING_LOCATION,
    WAITER_STATE_KEYS.SEARCHING_BAR_NAME,
  ],
  [WAITER_STATE_KEYS.AWAITING_LOCATION]: [
    WAITER_STATE_KEYS.DISCOVERY_MODE,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE,
  ],
  [WAITER_STATE_KEYS.SEARCHING_BAR_NAME]: [
    WAITER_STATE_KEYS.DISCOVERY_MODE,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE,
  ],
  [WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE]: [
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    WAITER_STATE_KEYS.DISCOVERY_MODE,
  ],
  [WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED]: [
    WAITER_STATE_KEYS.ORDERING,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    WAITER_STATE_KEYS.DISCOVERY_MODE,
  ],
  [WAITER_STATE_KEYS.ORDERING]: [
    WAITER_STATE_KEYS.PENDING_PAYMENT,
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
  ],
  [WAITER_STATE_KEYS.PENDING_PAYMENT]: [
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
  ],
};

/**
 * Default waiter session context
 */
export function createDefaultWaiterContext(
  entryMode: WaiterEntryMode = "home"
): WaiterSessionContext {
  return {
    entryMode,
    venueId: null,
    venueName: null,
    tableNumber: null,
    lastLocation: null,
    cartItemCount: 0,
    cartTotal: 0,
    currency: "RWF",
    conversationSessionId: null,
  };
}

/**
 * Bar/venue information returned from discovery
 */
export interface BarInfo {
  id: string;
  name: string;
  slug: string;
  locationText?: string;
  city?: string;
  country?: string;
  distanceKm?: number;
  currency?: string;
  hasMenu: boolean;
  isActive: boolean;
  features?: {
    live_music?: boolean;
    wifi?: boolean;
    parking?: boolean;
    outdoor?: boolean;
    late_night?: boolean;
  };
}

/**
 * Result from bar search/discovery
 */
export interface BarDiscoveryResult {
  bars: BarInfo[];
  searchType: "location" | "name" | "fallback";
  totalCount: number;
  fallbackUsed: boolean;
}
