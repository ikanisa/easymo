/**
 * Waiter AI Agent - Venue Discovery Tools
 *
 * Implements W4: Proper Waiter tools for bar discovery
 * - get_bars_near_location: Find bars near user's location
 * - search_bars_by_name: Search bars by name
 * - get_bar_info: Get detailed bar information
 *
 * @see docs/GROUND_RULES.md - Observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent, recordMetric } from "../../observability.ts";
import type { BarInfo, BarDiscoveryResult } from "./types.ts";

/**
 * Tool: get_bars_near_location
 * Find bars near a geographic location using the nearby_bars RPC
 *
 * @param supabase - Supabase client
 * @param lat - Latitude
 * @param lng - Longitude
 * @param radiusKm - Search radius in kilometers (default: 10)
 * @param limit - Max results to return (default: 5)
 */
export async function getBarsNearLocation(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  radiusKm = 10,
  limit = 5
): Promise<BarDiscoveryResult> {
  const startTime = Date.now();

  try {
    // Call the existing nearby_bars RPC function
    const { data, error } = await supabase.rpc("nearby_bars", {
      user_lat: lat,
      user_lon: lng,
      radius_km: radiusKm,
      _limit: limit,
    });

    if (error) {
      await logStructuredEvent("WAITER_BARS_LOCATION_ERROR", {
        lat,
        lng,
        radiusKm,
        error: error.message,
      }, "error");

      // Return empty result on error
      return {
        bars: [],
        searchType: "location",
        totalCount: 0,
        fallbackUsed: false,
      };
    }

    const bars: BarInfo[] = (data || []).map((bar: Record<string, unknown>) => ({
      id: bar.id as string,
      name: bar.name as string,
      slug: bar.slug as string,
      locationText: bar.location_text as string | undefined,
      city: bar.city_area as string | undefined,
      country: bar.country as string | undefined,
      distanceKm: bar.distance_km as number | undefined,
      currency: bar.currency as string | undefined,
      hasMenu: Boolean(bar.has_menu),
      isActive: bar.is_active !== false,
      features: {
        live_music: bar.live_music as boolean | undefined,
        wifi: bar.wifi as boolean | undefined,
        parking: bar.parking as boolean | undefined,
        outdoor: bar.outdoor as boolean | undefined,
        late_night: bar.late_night as boolean | undefined,
      },
    }));

    const result: BarDiscoveryResult = {
      bars,
      searchType: "location",
      totalCount: bars.length,
      fallbackUsed: false,
    };

    // Log and record metrics
    const duration = Date.now() - startTime;
    await logStructuredEvent("WAITER_BARS_LOCATION_SEARCH", {
      lat,
      lng,
      radiusKm,
      resultCount: bars.length,
      durationMs: duration,
    });

    recordMetric("waiter.bars_search.location", 1, {
      result_count: bars.length,
      duration_ms: duration,
    });

    return result;
  } catch (error) {
    await logStructuredEvent("WAITER_BARS_LOCATION_EXCEPTION", {
      lat,
      lng,
      radiusKm,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return {
      bars: [],
      searchType: "location",
      totalCount: 0,
      fallbackUsed: false,
    };
  }
}

/**
 * Tool: search_bars_by_name
 * Search bars by name using text search
 *
 * @param supabase - Supabase client
 * @param query - Search query (bar name)
 * @param limit - Max results to return (default: 5)
 */
export async function searchBarsByName(
  supabase: SupabaseClient,
  query: string,
  limit = 5
): Promise<BarDiscoveryResult> {
  const startTime = Date.now();
  
  // Sanitize input: remove special characters that could affect search
  const sanitizedQuery = query
    .trim()
    .toLowerCase()
    .replace(/[%_\\]/g, "") // Remove SQL wildcards and escape char
    .replace(/[^\w\s'-]/g, ""); // Keep only word chars, spaces, apostrophes, hyphens

  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return {
      bars: [],
      searchType: "name",
      totalCount: 0,
      fallbackUsed: false,
    };
  }

  try {
    // Search bars by name using ilike pattern (parameterized query via Supabase)
    const { data, error } = await supabase
      .from("bars")
      .select(`
        id,
        name,
        slug,
        location_text,
        city_area,
        country,
        currency,
        is_active,
        live_music,
        wifi,
        parking,
        outdoor,
        late_night
      `)
      .eq("is_active", true)
      .ilike("name", `%${sanitizedQuery}%`)
      .order("name")
      .limit(limit);

    if (error) {
      await logStructuredEvent("WAITER_BARS_NAME_SEARCH_ERROR", {
        query: sanitizedQuery,
        error: error.message,
      }, "error");

      return {
        bars: [],
        searchType: "name",
        totalCount: 0,
        fallbackUsed: false,
      };
    }

    // Check if each bar has a menu (don't assume)
    const barsWithMenuCheck = await Promise.all(
      (data || []).map(async (bar: Record<string, unknown>) => {
        const hasMenu = await barHasMenu(supabase, bar.id as string);
        return {
          id: bar.id as string,
          name: bar.name as string,
          slug: bar.slug as string,
          locationText: bar.location_text as string | undefined,
          city: bar.city_area as string | undefined,
          country: bar.country as string | undefined,
          currency: bar.currency as string | undefined,
          hasMenu,
          isActive: bar.is_active !== false,
          features: {
            live_music: bar.live_music as boolean | undefined,
            wifi: bar.wifi as boolean | undefined,
            parking: bar.parking as boolean | undefined,
            outdoor: bar.outdoor as boolean | undefined,
            late_night: bar.late_night as boolean | undefined,
          },
        };
      })
    );

    const bars: BarInfo[] = barsWithMenuCheck;

    const duration = Date.now() - startTime;
    await logStructuredEvent("WAITER_BARS_NAME_SEARCH", {
      query: sanitizedQuery,
      resultCount: bars.length,
      durationMs: duration,
    });

    recordMetric("waiter.bars_search.name", 1, {
      result_count: bars.length,
      duration_ms: duration,
    });

    return {
      bars,
      searchType: "name",
      totalCount: bars.length,
      fallbackUsed: false,
    };
  } catch (error) {
    await logStructuredEvent("WAITER_BARS_NAME_SEARCH_EXCEPTION", {
      query: sanitizedQuery,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return {
      bars: [],
      searchType: "name",
      totalCount: 0,
      fallbackUsed: false,
    };
  }
}

/**
 * Tool: get_bar_info
 * Get detailed information about a specific bar
 *
 * @param supabase - Supabase client
 * @param barId - Bar UUID
 */
export async function getBarInfo(
  supabase: SupabaseClient,
  barId: string
): Promise<BarInfo | null> {
  try {
    const { data: bar, error } = await supabase
      .from("bars")
      .select(`
        id,
        name,
        slug,
        location_text,
        city_area,
        country,
        currency,
        is_active,
        phone,
        payment_settings,
        live_music,
        wifi,
        parking,
        outdoor,
        late_night
      `)
      .eq("id", barId)
      .single();

    if (error || !bar) {
      await logStructuredEvent("WAITER_BAR_INFO_ERROR", {
        barId,
        error: error?.message || "Bar not found",
      }, "error");
      return null;
    }

    await logStructuredEvent("WAITER_BAR_INFO_FETCHED", {
      barId,
      barName: bar.name,
    });

    return {
      id: bar.id,
      name: bar.name,
      slug: bar.slug,
      locationText: bar.location_text,
      city: bar.city_area,
      country: bar.country,
      currency: bar.currency || "RWF",
      hasMenu: true,
      isActive: bar.is_active !== false,
      features: {
        live_music: bar.live_music,
        wifi: bar.wifi,
        parking: bar.parking,
        outdoor: bar.outdoor,
        late_night: bar.late_night,
      },
    };
  } catch (error) {
    await logStructuredEvent("WAITER_BAR_INFO_EXCEPTION", {
      barId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return null;
  }
}

/**
 * Check if a bar has an active menu
 *
 * @param supabase - Supabase client
 * @param barId - Bar UUID
 */
export async function barHasMenu(
  supabase: SupabaseClient,
  barId: string
): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("restaurant_menu_items")
      .select("*", { count: "exact", head: true })
      .eq("bar_id", barId)
      .eq("is_available", true);

    if (error) {
      return false;
    }

    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Format bar list for WhatsApp display
 *
 * @param bars - List of bars
 * @param maxBars - Maximum bars to include (default: 5)
 */
export function formatBarsForWhatsApp(bars: BarInfo[], maxBars = 5): string {
  if (bars.length === 0) {
    return "No bars found nearby. Try searching by name or check back later.";
  }

  const displayBars = bars.slice(0, maxBars);
  const lines: string[] = [];

  displayBars.forEach((bar, index) => {
    const num = index + 1;
    const distance = bar.distanceKm
      ? ` (${bar.distanceKm.toFixed(1)}km)`
      : "";
    const location = bar.locationText || bar.city || "";

    lines.push(`${num}. *${bar.name}*${distance}`);
    if (location) {
      lines.push(`   📍 ${location}`);
    }
  });

  return lines.join("\n");
}
