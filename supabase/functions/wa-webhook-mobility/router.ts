// ============================================================================
// WA-WEBHOOK-MOBILITY - ROUTING MODULE
// ============================================================================
// Extracted routing logic from index.ts for cleaner architecture
// Uses a routing map instead of large if-else chains
// ============================================================================

import type { RouterContext } from "./types.ts";
import { IDS } from "./wa/ids.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

// State keys for mobility flows
export const STATE_KEYS = {
  MOBILITY: {
    NEARBY_SELECT: "mobility_nearby_select",
    NEARBY_LOCATION: "mobility_nearby_location",
    NEARBY_RESULTS: "mobility_nearby_results",
    GO_ONLINE: "mobility_go_online",
    LOCATION_SAVED_PICKER: "mobility_location_saved_picker",
    SCHEDULE_ROLE: "mobility_schedule_role",
    SCHEDULE_VEHICLE: "mobility_schedule_vehicle",
    SCHEDULE_LOCATION: "mobility_schedule_location",
    SCHEDULE_DROPOFF: "mobility_schedule_dropoff",
    SCHEDULE_TIME: "mobility_schedule_time",
    SCHEDULE_RECURRENCE: "mobility_schedule_recurrence",
    TRIP_IN_PROGRESS: "mobility_trip_in_progress",
  },
} as const;

// Trip cancellation reasons
export const CANCELLATION_REASONS = {
  USER_CANCELLED: "user_cancelled",
  DRIVER_NO_SHOW: "driver_no_show",
  PASSENGER_NO_SHOW: "passenger_no_show",
  TIMEOUT: "timeout",
  SYSTEM: "system",
} as const;

// ============================================================================
// ROUTE TYPES
// ============================================================================

export type RouteHandler = (
  ctx: RouterContext,
  state: StateData | null,
  payload: RoutePayload,
) => Promise<boolean>;

export interface StateData {
  key: string;
  data: Record<string, unknown>;
}

export interface RoutePayload {
  id?: string;
  text?: string;
  location?: { lat: number; lng: number };
  mediaId?: string;
  mimeType?: string;
}

// ============================================================================
// STATIC ROUTES (ID-based)
// ============================================================================

// Simple ID to handler key mapping
export const STATIC_ROUTES: Record<string, string> = {
  // Main menu
  [IDS.RIDES_MENU]: "SHOW_MOBILITY_MENU",
  rides_agent: "SHOW_MOBILITY_MENU",
  rides: "SHOW_MOBILITY_MENU",
  [IDS.BACK_MENU]: "SHOW_MOBILITY_MENU",
  [IDS.BACK_HOME]: "SHOW_MOBILITY_MENU",

  // Nearby flows
  [IDS.SEE_DRIVERS]: "HANDLE_SEE_DRIVERS",
  [IDS.SEE_PASSENGERS]: "HANDLE_SEE_PASSENGERS",
  [IDS.MOBILITY_CHANGE_VEHICLE]: "HANDLE_CHANGE_VEHICLE",

  // Go Online / Offline
  [IDS.GO_ONLINE]: "START_GO_ONLINE",
  driver_go_online: "START_GO_ONLINE",
  [IDS.DRIVER_GO_OFFLINE]: "HANDLE_GO_OFFLINE",

  // Schedule
  [IDS.SCHEDULE_TRIP]: "START_SCHEDULE_TRIP",

  // Verification
  [IDS.VERIFY_LICENSE]: "START_LICENSE_VERIFICATION",
  [IDS.VERIFY_STATUS]: "SHOW_VERIFICATION_MENU",
};

// ============================================================================
// DYNAMIC ROUTES (prefix-based)
// ============================================================================

export const DYNAMIC_ROUTE_PREFIXES = [
  { prefix: `${IDS.DRIVER_OFFER_RIDE}::`, handler: "ROUTE_DRIVER_ACTION" },
  { prefix: `${IDS.DRIVER_VIEW_DETAILS}::`, handler: "ROUTE_DRIVER_ACTION" },
  { prefix: "MTCH::", handler: "HANDLE_NEARBY_RESULT_SELECTION" },
  { prefix: "time::", handler: "HANDLE_SCHEDULE_TIME" },
  { prefix: "recur::", handler: "HANDLE_SCHEDULE_RECURRENCE" },
  { prefix: "FAV::", handler: "HANDLE_SAVED_LOCATION_SELECTION" },
  { prefix: "RECENT_SEARCH::", handler: "HANDLE_RECENT_SEARCH_SELECTION" },
] as const;

// ============================================================================
// STATE-DEPENDENT ROUTES
// ============================================================================

export interface StateRoute {
  stateKey: string;
  conditions?: Array<{
    idMatch?: string | RegExp;
    handler: string;
  }>;
  defaultHandler?: string;
}

export const STATE_ROUTES: StateRoute[] = [
  {
    stateKey: STATE_KEYS.MOBILITY.NEARBY_SELECT,
    conditions: [
      { idMatch: /^(motorcycle|car|bus|truck|van|taxi|pickup|suv|sedan|minibus|coaster)$/, handler: "HANDLE_VEHICLE_SELECTION" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.NEARBY_LOCATION,
    conditions: [
      { idMatch: IDS.USE_CACHED_LOCATION, handler: "HANDLE_USE_CACHED_LOCATION" },
      { idMatch: IDS.USE_LAST_LOCATION, handler: "HANDLE_USE_LAST_LOCATION" },
      { idMatch: IDS.LOCATION_SAVED_LIST, handler: "START_NEARBY_SAVED_LOCATION_PICKER" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.GO_ONLINE,
    conditions: [
      { idMatch: IDS.USE_CACHED_LOCATION, handler: "HANDLE_GO_ONLINE_USE_CACHED" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.SCHEDULE_ROLE,
    conditions: [
      { idMatch: IDS.ROLE_DRIVER, handler: "HANDLE_SCHEDULE_ROLE" },
      { idMatch: IDS.ROLE_PASSENGER, handler: "HANDLE_SCHEDULE_ROLE" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.SCHEDULE_VEHICLE,
    conditions: [
      { idMatch: /^(motorcycle|car|bus|truck|van|taxi|pickup|suv|sedan|minibus|coaster)$/, handler: "HANDLE_SCHEDULE_VEHICLE" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.SCHEDULE_LOCATION,
    conditions: [
      { idMatch: /^(motorcycle|car|bus|truck|van|taxi|pickup|suv|sedan|minibus|coaster)$/, handler: "HANDLE_SCHEDULE_VEHICLE" },
      { idMatch: IDS.USE_LAST_LOCATION, handler: "HANDLE_SCHEDULE_USE_LAST_LOCATION" },
      { idMatch: IDS.LOCATION_SAVED_LIST, handler: "START_SCHEDULE_SAVED_LOCATION_PICKER_PICKUP" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.SCHEDULE_DROPOFF,
    conditions: [
      { idMatch: IDS.SCHEDULE_SKIP_DROPOFF, handler: "HANDLE_SCHEDULE_SKIP_DROPOFF" },
      { idMatch: IDS.LOCATION_SAVED_LIST, handler: "START_SCHEDULE_SAVED_LOCATION_PICKER_DROPOFF" },
    ],
  },
  {
    stateKey: STATE_KEYS.MOBILITY.SCHEDULE_TIME,
    defaultHandler: "HANDLE_SCHEDULE_TIME",
  },
  {
    stateKey: STATE_KEYS.MOBILITY.SCHEDULE_RECURRENCE,
    defaultHandler: "HANDLE_SCHEDULE_RECURRENCE",
  },
  {
    stateKey: STATE_KEYS.MOBILITY.NEARBY_RESULTS,
    conditions: [
      { idMatch: IDS.SCHEDULE_REFRESH_RESULTS, handler: "HANDLE_SCHEDULE_REFRESH" },
    ],
  },
];

// ============================================================================
// TRIP LIFECYCLE ROUTES
// ============================================================================

export const TRIP_LIFECYCLE_IDS = [
  IDS.TRIP_START,
  IDS.TRIP_ARRIVED,
  IDS.TRIP_PICKED_UP,
  IDS.TRIP_COMPLETE,
];

export function isTripLifecycleId(id: string): boolean {
  return (
    TRIP_LIFECYCLE_IDS.includes(id as typeof TRIP_LIFECYCLE_IDS[number]) ||
    id.startsWith(IDS.TRIP_CANCEL_PREFIX) ||
    id.startsWith(IDS.RATE_PREFIX)
  );
}

// ============================================================================
// ROUTING UTILITIES
// ============================================================================

/**
 * Find a static route handler for an ID
 */
export function findStaticRoute(id: string): string | undefined {
  return STATIC_ROUTES[id];
}

/**
 * Find a dynamic route handler based on ID prefix
 */
export function findDynamicRoute(id: string): string | undefined {
  for (const route of DYNAMIC_ROUTE_PREFIXES) {
    if (id.startsWith(route.prefix)) {
      return route.handler;
    }
  }
  return undefined;
}

/**
 * Find a state-dependent route handler
 */
export function findStateRoute(
  stateKey: string | undefined,
  id: string | undefined,
): string | undefined {
  if (!stateKey) return undefined;

  for (const route of STATE_ROUTES) {
    if (route.stateKey === stateKey) {
      // Check specific conditions
      if (route.conditions && id) {
        for (const condition of route.conditions) {
          if (condition.idMatch) {
            if (typeof condition.idMatch === "string") {
              if (id === condition.idMatch) return condition.handler;
            } else if (condition.idMatch.test(id)) {
              return condition.handler;
            }
          }
        }
      }
      // Return default handler if no conditions matched
      if (route.defaultHandler) return route.defaultHandler;
    }
  }
  return undefined;
}

/**
 * Log routing decision for debugging
 */
export function logRoutingDecision(
  decision: {
    id?: string;
    stateKey?: string;
    handler?: string;
    source: "static" | "dynamic" | "state" | "text" | "unhandled";
  },
): void {
  logStructuredEvent("MOBILITY_ROUTING_DECISION", {
    id: decision.id,
    stateKey: decision.stateKey,
    handler: decision.handler,
    source: decision.source,
  }, "debug");
}
