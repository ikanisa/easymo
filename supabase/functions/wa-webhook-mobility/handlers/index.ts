/**
 * Mobility Handlers Registry
 * Lazy-loaded handler registration for optimal cold starts
 */

import { lazy, preloadHandlers } from "../../_shared/handlers/lazy-loader.ts";

// ============================================================================
// LAZY HANDLER DEFINITIONS
// ============================================================================

/**
 * Nearby drivers/passengers handler
 */
export const nearbyHandler = lazy(
  "mobility:nearby",
  () => import("./nearby/index.ts")
);

/**
 * Trip scheduling handler
 */
export const scheduleHandler = lazy(
  "mobility:schedule",
  () => import("./schedule/index.ts")
);

/**
 * Trip lifecycle handler
 */
export const tripHandler = lazy(
  "mobility:trip",
  () => import("./trip/index.ts")
);

/**
 * Go online/offline handler
 */
export const onlineHandler = lazy(
  "mobility:online",
  () => import("./driver/online.ts")
);

/**
 * Driver verification handler
 */
export const verificationHandler = lazy(
  "mobility:verification",
  () => import("./driver/verification.ts")
);

// ============================================================================
// PRELOAD CRITICAL HANDLERS
// ============================================================================

/**
 * Preload handlers that are commonly used
 * Called after initial request to warm up subsequent calls
 */
export function preloadCriticalHandlers(): void {
  preloadHandlers([
    "mobility:nearby",
    "mobility:trip",
  ]);
}

// ============================================================================
// HANDLER DISPATCH
// ============================================================================

/**
 * Get handler for action
 */
export async function getHandler(action: string) {
  switch (action) {
    case "nearby":
    case "see_drivers":
    case "see_passengers":
      return nearbyHandler.load();

    case "schedule":
    case "schedule_trip":
      return scheduleHandler.load();

    case "trip":
    case "trip_start":
    case "trip_complete":
      return tripHandler.load();

    case "online":
    case "go_online":
    case "go_offline":
      return onlineHandler.load();

    case "verify":
    case "verification":
      return verificationHandler.load();

    default:
      return null;
  }
}
