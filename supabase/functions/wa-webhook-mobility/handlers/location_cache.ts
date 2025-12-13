/**
 * Location cache validation utilities
 * 
 * Helpers for validating cached location timestamps and ensuring
 * location data is fresh enough for nearby matching.
 */

import { LOCATION_CONFIG } from "../../_shared/location-config.ts";

/**
 * Default cache duration in minutes
 * Location data older than this will be considered stale
 */
export const LOCATION_CACHE_MINUTES = LOCATION_CONFIG.CACHE_TTL_MINUTES;

/**
 * Check if a cached location timestamp is still valid
 * 
 * @param lastLocationAt - ISO timestamp string or null
 * @param cacheMinutes - Optional custom cache duration (defaults to 30 min)
 * @returns true if location cache is valid, false if expired or missing
 * 
 * @example
 * ```typescript
 * const locationAt = '2025-11-23T10:00:00Z';
 * const isValid = isLocationCacheValid(locationAt);
 * if (!isValid) {
 *   // Request fresh location
 * }
 * ```
 */
export function isLocationCacheValid(
  lastLocationAt: string | null,
  cacheMinutes: number = LOCATION_CACHE_MINUTES,
): boolean {
  if (!lastLocationAt) return false;

  try {
    const cacheTime = new Date(lastLocationAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);
    
    return diffMinutes <= cacheMinutes;
  } catch (error) {
    // Invalid date format - treat as invalid cache
    return false;
  }
}

/**
 * Calculate how many minutes ago a location was cached
 * 
 * @param lastLocationAt - ISO timestamp string
 * @returns Number of minutes since location was cached, or null if invalid
 */
export function getLocationCacheAge(
  lastLocationAt: string | null,
): number | null {
  if (!lastLocationAt) return null;

  try {
    const cacheTime = new Date(lastLocationAt);
    
    // Check if date is invalid (NaN)
    if (isNaN(cacheTime.getTime())) {
      return null;
    }
    
    const now = new Date();
    return Math.floor((now.getTime() - cacheTime.getTime()) / (1000 * 60));
  } catch (error) {
    return null;
  }
}

/**
 * Format cache age as human-readable string
 * 
 * @param lastLocationAt - ISO timestamp string
 * @returns Human-readable age string (e.g., "5 mins ago", "expired")
 */
export function formatLocationCacheAge(
  lastLocationAt: string | null,
): string {
  const age = getLocationCacheAge(lastLocationAt);
  
  if (age === null) return 'never cached';
  if (age === 0) return 'just now';
  if (age === 1) return '1 min ago';
  if (age < 60) return `${age} mins ago`;
  
  const hours = Math.floor(age / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

/**
 * Check if location needs refresh and return appropriate message
 * 
 * @param lastLocationAt - ISO timestamp string or null
 * @returns Object with needsRefresh flag and optional message
 */
export function checkLocationCache(
  lastLocationAt: string | null,
): { needsRefresh: boolean; message?: string } {
  if (!lastLocationAt) {
    return {
      needsRefresh: true,
      message: '📍 Please share your current location',
    };
  }

  const isValid = isLocationCacheValid(lastLocationAt);
  
  if (!isValid) {
    const age = formatLocationCacheAge(lastLocationAt);
    return {
      needsRefresh: true,
      message: `📍 Your cached location is too old (${age}). Please share your current location.`,
    };
  }

  return { needsRefresh: false };
}
