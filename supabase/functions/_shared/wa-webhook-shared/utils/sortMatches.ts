import type { MatchResult } from "../rpc/mobility.ts";

/**
 * Sort strategy for match results.
 * - 'distance': Prioritize closest matches first, then by most recent
 * - 'time': Prioritize most recent matches first, then by distance
 */
export type SortStrategy = "distance" | "time";

export interface SortMatchesOptions {
  /**
   * What to prioritize in sorting.
   * Defaults to 'distance' for nearby flows, 'time' for scheduled flows.
   */
  prioritize?: SortStrategy;
}

/**
 * Get the timestamp from a match result, preferring matched_at over created_at.
 */
function getMatchTimestamp(match: MatchResult): string | null {
  return match.matched_at ?? match.created_at ?? null;
}

/**
 * Convert a match's timestamp to milliseconds for comparison.
 */
function timestampMs(match: MatchResult): number {
  const timestamp = getMatchTimestamp(match);
  return timestamp ? Date.parse(timestamp) : 0;
}

/**
 * Get the distance from a match, returning MAX_SAFE_INTEGER if not available.
 */
function getDistance(match: MatchResult): number {
  return typeof match.distance_km === "number"
    ? match.distance_km
    : Number.MAX_SAFE_INTEGER;
}

/**
 * Shared sorting function for match results.
 * Provides consistent sorting across all mobility flows.
 *
 * @param matches - Array of match results to sort
 * @param options - Sorting options
 * @returns Sorted array (mutates original)
 *
 * @example
 * // Sort by distance (default for nearby flows)
 * const sorted = sortMatches(matches, { prioritize: 'distance' });
 *
 * @example
 * // Sort by time (for scheduled flows)
 * const sorted = sortMatches(matches, { prioritize: 'time' });
 */
export function sortMatches(
  matches: MatchResult[],
  options: SortMatchesOptions = {},
): MatchResult[] {
  const { prioritize = "distance" } = options;

  return matches.sort((a, b) => {
    if (prioritize === "distance") {
      // Distance first, then time (most recent), then trip_id for stability
      const distA = getDistance(a);
      const distB = getDistance(b);
      if (distA !== distB) return distA - distB;

      const timeA = timestampMs(a);
      const timeB = timestampMs(b);
      if (timeB !== timeA) return timeB - timeA;

      return (a.trip_id ?? "").localeCompare(b.trip_id ?? "");
    }

    // Time first (most recent), then distance, then trip_id for stability
    const timeA = timestampMs(a);
    const timeB = timestampMs(b);
    if (timeB !== timeA) return timeB - timeA;

    const distA = getDistance(a);
    const distB = getDistance(b);
    if (distA !== distB) return distA - distB;

    return (a.trip_id ?? "").localeCompare(b.trip_id ?? "");
  });
}

/**
 * Comparator function for sorting by distance first.
 * Can be used directly with Array.sort().
 */
export function compareByDistance(a: MatchResult, b: MatchResult): number {
  const distA = getDistance(a);
  const distB = getDistance(b);
  if (distA !== distB) return distA - distB;

  const timeA = timestampMs(a);
  const timeB = timestampMs(b);
  if (timeB !== timeA) return timeB - timeA;

  return (a.trip_id ?? "").localeCompare(b.trip_id ?? "");
}

/**
 * Comparator function for sorting by time first.
 * Can be used directly with Array.sort().
 */
export function compareByTime(a: MatchResult, b: MatchResult): number {
  const timeA = timestampMs(a);
  const timeB = timestampMs(b);
  if (timeB !== timeA) return timeB - timeA;

  const distA = getDistance(a);
  const distB = getDistance(b);
  if (distA !== distB) return distA - distB;

  return (a.trip_id ?? "").localeCompare(b.trip_id ?? "");
}
