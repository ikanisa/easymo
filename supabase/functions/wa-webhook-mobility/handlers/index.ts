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
  () => import("./nearby.ts"),
);

/**
 * Trip scheduling handler
 */
export const scheduleHandler = lazy(
  "mobility:schedule",
  () => import("./schedule.ts"),
);

/**
 * Go online/offline handler
 */
export const onlineHandler = lazy(
  "mobility:online",
  () => import("./go_online.ts"),
);

// NOTE: Driver verification handler removed per GROUND_RULES
// Payment handlers, fare.ts, ai-agents/, driver_verification.ts are prohibited in mobility function

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

    case "online":
    case "go_online":
    case "go_offline":
      return onlineHandler.load();

    default:
      return null;
  }
}
