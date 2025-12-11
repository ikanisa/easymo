/**
 * Mobility Configuration Constants
 * Centralized configuration for mobility services to prevent hardcoded values
 * 
 * TIME WINDOWS:
 * - All time windows standardized to 30 minutes for real-time matching
 * - Recent searches: 30 minutes
 * - Trip matching: 30 minutes (intent-based trips)
 * - Trip expiry: 30 minutes (intent-based trips)
 * - Location cache (client-side): 30 minutes
 * - Location freshness (SQL-side): 30 minutes
 */

// Search and matching constants
export const MOBILITY_CONFIG = {
  /** Default search radius in meters (10km) */
  DEFAULT_SEARCH_RADIUS_METERS: 10_000,
  /** Maximum search radius in meters (25km) */
  MAX_SEARCH_RADIUS_METERS: 25_000,
  /** Location cache window in minutes (30 min) - for client-side caching */
  LOCATION_FRESHNESS_MINUTES: 30,
  /** Recent search window in minutes (30 min) */
  RECENT_SEARCH_WINDOW_MINUTES: 30,
  /** Trip expiry time in minutes (30 min for intent-based trips) */
  TRIP_EXPIRY_MINUTES: 30,
  /** Trip matching window in minutes (30 min) */
  TRIP_MATCHING_WINDOW_MINUTES: 30,
  /** Maximum number of results to return */
  MAX_RESULTS_LIMIT: 9,
} as const;

/**
 * Environment-aware trip expiry configuration
 * Allows runtime override via MOBILITY_TRIP_EXPIRY_MINUTES
 */
export function getTripExpiryMs(): number {
  const envExpiry = Number(
    // deno-lint-ignore no-explicit-any
    typeof Deno !== "undefined" ? (Deno as any).env?.get?.("MOBILITY_TRIP_EXPIRY_MINUTES") : undefined,
  );
  const minutes = Number.isFinite(envExpiry) && envExpiry > 0
    ? envExpiry
    : MOBILITY_CONFIG.TRIP_EXPIRY_MINUTES;
  return minutes * 60 * 1000;
}

/**
 * Get search radius in meters, respecting min/max bounds
 */
export function getSearchRadiusMeters(configRadiusKm?: number | null): number {
  if (!Number.isFinite(configRadiusKm ?? NaN)) {
    return MOBILITY_CONFIG.DEFAULT_SEARCH_RADIUS_METERS;
  }
  const meters = Math.round(Number(configRadiusKm) * 1000);
  if (!Number.isFinite(meters) || meters <= 0) {
    return MOBILITY_CONFIG.DEFAULT_SEARCH_RADIUS_METERS;
  }
  return Math.min(
    Math.max(meters, MOBILITY_CONFIG.DEFAULT_SEARCH_RADIUS_METERS),
    MOBILITY_CONFIG.MAX_SEARCH_RADIUS_METERS,
  );
}
