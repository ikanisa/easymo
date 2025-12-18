/**
 * PostGIS-Based Vendor Proximity Queries
 * 
 * Sub-second proximity searches using PostGIS geography columns.
 * Prioritizes Tier 1 (onboarded) vendors over Tier 2 (public) vendors.
 * 
 * Performance: Uses GIST index on coords column for O(log n) spatial queries.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../observability.ts";
import type { VendorCandidate } from "../types/buy-sell.ts";

export interface ProximitySearchOptions {
  radiusKm?: number;
  category?: string;
  limit?: number;
  preferOnboarded?: boolean;
  minRating?: number;
}

/**
 * Find vendors near a location using PostGIS
 * 
 * Returns vendors prioritized by:
 * 1. Tier (is_onboarded = true first)
 * 2. Distance (closest first)
 * 3. Rating (highest first)
 * 
 * @param lat - User latitude
 * @param lng - User longitude
 * @param options - Search options
 */
export async function findVendorsNearby(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  options: ProximitySearchOptions = {},
  correlationId?: string
): Promise<VendorCandidate[]> {
  const {
    radiusKm = 15.0,
    category,
    limit = 20,
    preferOnboarded = true,
    minRating,
  } = options;

  const startTime = Date.now();

  try {
    // Use PostGIS RPC function for sub-second performance
    const { data, error } = await supabase.rpc("find_vendors_nearby", {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_category: category || null,
      p_limit: limit,
      p_prefer_onboarded: preferOnboarded,
    });

    if (error) {
      logStructuredEvent("VENDOR_PROXIMITY_QUERY_ERROR", {
        error: error.message,
        lat,
        lng,
        radiusKm,
        correlationId,
      }, "error");
      return [];
    }

    const duration = Date.now() - startTime;

    // Filter by minimum rating if specified
    let vendors = (data as Array<{
      id: string;
      business_name: string;
      phone: string;
      address: string;
      lat: number;
      lng: number;
      is_onboarded: boolean;
      is_opted_in: boolean;
      average_rating: number;
      positive_response_count: number;
      distance_km: number;
      source: string;
    }>) || [];

    if (minRating !== undefined) {
      vendors = vendors.filter(v => (v.average_rating || 0) >= minRating);
    }

    // Filter out vendors without phone (required for outreach)
    vendors = vendors.filter(v => v.phone);

    // Convert to VendorCandidate format
    const candidates: VendorCandidate[] = vendors.map(v => ({
      id: v.id,
      name: v.business_name,
      phone: v.phone,
      address: undefined, // vendors table doesn't have address column
      lat: v.lat,
      lng: v.lng,
      source: v.source as "internal_db" | "google_maps" | "google_search",
      is_onboarded: v.is_onboarded,
      score: calculateVendorScore(v, preferOnboarded),
      rating: v.average_rating,
    }));

    logStructuredEvent("VENDOR_PROXIMITY_QUERY", {
      resultCount: candidates.length,
      onboardedCount: candidates.filter(v => v.is_onboarded).length,
      durationMs: duration,
      radiusKm,
      correlationId,
    });

    return candidates;
  } catch (error) {
    logStructuredEvent("VENDOR_PROXIMITY_QUERY_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      lat,
      lng,
      correlationId,
    }, "error");
    return [];
  }
}

/**
 * Find businesses near a location (fallback/complement to vendors)
 */
export async function findBusinessesNearby(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  options: {
    radiusKm?: number;
    categoryKey?: string;
    limit?: number;
  } = {},
  correlationId?: string
): Promise<VendorCandidate[]> {
  const {
    radiusKm = 15.0,
    categoryKey,
    limit = 20,
  } = options;

  try {
    const { data, error } = await supabase.rpc("find_businesses_nearby", {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_category_key: categoryKey || null,
      p_limit: limit,
    });

    if (error) {
      logStructuredEvent("BUSINESS_PROXIMITY_QUERY_ERROR", {
        error: error.message,
        lat,
        lng,
        correlationId,
      }, "error");
      return [];
    }

    // Convert to VendorCandidate format
    const candidates: VendorCandidate[] = (data || []).map((b: {
      id: string;
      name: string;
      phone: string;
      address: string;
      lat: number;
      lng: number;
      buy_sell_category: string;
      rating: number;
      distance_km: number;
    }) => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      source: "internal_db" as const,
      is_onboarded: false, // Businesses are not onboarded vendors
      score: 0.5 + (b.rating || 0) * 0.1, // Score based on rating
      rating: b.rating,
    }));

    return candidates;
  } catch (error) {
    logStructuredEvent("BUSINESS_PROXIMITY_QUERY_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    }, "error");
    return [];
  }
}

/**
 * Calculate vendor score based on tier, distance, and rating
 */
function calculateVendorScore(
  vendor: {
    is_onboarded: boolean;
    distance_km: number;
    average_rating: number;
    positive_response_count: number;
  },
  preferOnboarded: boolean
): number {
  let score = 0.5; // Base score

  // Tier bonus (Tier 1 = onboarded)
  if (vendor.is_onboarded && preferOnboarded) {
    score += 0.3; // Significant boost for Tier 1
  }

  // Distance score (closer = better, max 15km)
  const distanceScore = Math.max(0, 1 - (vendor.distance_km / 15.0));
  score += distanceScore * 0.2;

  // Rating score
  const ratingScore = (vendor.average_rating || 0) / 5.0;
  score += ratingScore * 0.1;

  // Response count bonus (more responses = more reliable)
  const responseBonus = Math.min(0.1, vendor.positive_response_count / 100.0);
  score += responseBonus;

  return Math.min(1.0, score); // Cap at 1.0
}

/**
 * Get Tier 1 (onboarded) vendors for a location
 * This is the highest priority search
 */
export async function getTier1Vendors(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  options: {
    radiusKm?: number;
    category?: string;
    limit?: number;
  } = {},
  correlationId?: string
): Promise<VendorCandidate[]> {
  return findVendorsNearby(
    supabase,
    lat,
    lng,
    {
      ...options,
      preferOnboarded: true,
    },
    correlationId
  ).then(vendors => vendors.filter(v => v.is_onboarded));
}

