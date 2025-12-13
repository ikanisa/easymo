// Shared utility for saving user location to cache and history
import type { RouterContext } from "../types.ts";
import { saveLocationToCache } from "./cache.ts";
import { saveRecentLocation, type RecentSource } from "./recent.ts";

/**
 * Save location to both cache (30-min TTL) and recent_locations (history)
 * 
 * @param ctx - Router context with supabase client and user info
 * @param coords - Latitude and longitude coordinates
 * @param source - Source of location (e.g., 'mobility', 'bars', etc.)
 */
export async function saveUserLocation(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
  source: RecentSource = 'mobility',
): Promise<void> {
  if (!ctx.profileId) {
    console.warn('saveUserLocation: No profileId, skipping save');
    return;
  }

  try {
    // Save to cache (30 min TTL for auto-reuse)
    await saveLocationToCache(ctx.supabase, ctx.profileId, coords);
    
    // Save to recent_locations table (for "Use Last Location" button)
    await saveRecentLocation(ctx, coords, source);
  } catch (error) {
    console.error('save_user_location_fail', error);
    // Don't throw - we don't want to fail the search if cache save fails
  }
}
