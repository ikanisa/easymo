/**
 * Optimized Queries
 * Pre-built optimized queries for common operations
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { query } from "./query-builder.ts";
import { getCachedProfile } from "../cache/index.ts";
import { logStructuredEvent } from "../observability/index.ts";

// ============================================================================
// PROFILE QUERIES
// ============================================================================

/**
 * Get profile by ID (optimized with minimal fields)
 */
export async function getProfileById(
  supabase: SupabaseClient,
  userId: string,
  options: { useCache?: boolean; fields?: string } = {}
): Promise<any | null> {
  const { useCache = true, fields = "user_id, whatsapp_e164, full_name, language" } = options;

  if (useCache) {
    const cached = await getCachedProfile(supabase, userId);
    if (cached) return cached;
  }

  const result = await query(supabase, "profiles")
    .select(fields)
    .eq("user_id", userId)
    .single();

  return result.data;
}

/**
 * Get profile by phone (optimized)
 */
export async function getProfileByPhone(
  supabase: SupabaseClient,
  phone: string,
  options: { fields?: string } = {}
): Promise<any | null> {
  const { fields = "user_id, whatsapp_e164, full_name, language" } = options;

  const result = await query(supabase, "profiles")
    .select(fields)
    .eq("whatsapp_e164", phone)
    .single();

  return result.data;
}

// ============================================================================
// TRIP QUERIES
// ============================================================================

/**
 * Find nearby drivers (optimized with spatial query hint)
 */
export async function findNearbyDrivers(
  supabase: SupabaseClient,
  location: { lat: number; lng: number },
  options: {
    vehicleType?: string;
    radiusKm?: number;
    limit?: number;
    windowDays?: number;
  } = {}
): Promise<any[]> {
  const {
    vehicleType,
    radiusKm = 15,
    limit = 9,
    windowDays = 30,
  } = options;

  const startTime = performance.now();
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Use RPC for spatial query (more efficient with PostGIS)
  const { data, error } = await supabase.rpc("find_nearby_drivers", {
    p_lat: location.lat,
    p_lng: location.lng,
    p_radius_km: radiusKm,
    p_vehicle_type: vehicleType || null,
    p_limit: limit,
    p_window_start: windowStart,
  });

  const duration = performance.now() - startTime;

  if (error) {
    logStructuredEvent("NEARBY_DRIVERS_QUERY_ERROR", {
      error: error.message,
      duration,
    }, "error");

    // Fallback to regular query
    return await findNearbyDriversFallback(supabase, location, options);
  }

  logStructuredEvent("NEARBY_DRIVERS_QUERY", {
    resultCount: data?.length || 0,
    duration,
  }, "debug");

  return data || [];
}

/**
 * Fallback query without PostGIS
 */
async function findNearbyDriversFallback(
  supabase: SupabaseClient,
  location: { lat: number; lng: number },
  options: {
    vehicleType?: string;
    limit?: number;
    windowDays?: number;
  } = {}
): Promise<any[]> {
  const { vehicleType, limit = 9, windowDays = 30 } = options;
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const builder = query(supabase, "trips")
    .select("id, user_id, pickup_lat, pickup_lng, vehicle_type, created_at")
    .eq("role", "driver")
    .eq("status", "open")
    .gte("created_at", windowStart)
    .limit(limit * 3); // Get more, filter by distance client-side

  if (vehicleType) {
    builder.eq("vehicle_type", vehicleType);
  }

  const result = await builder.orderBy("created_at", "desc").execute();

  if (!result.data) return [];

  // Calculate distances and filter
  const radiusKm = 15;
  return result.data
    .map((trip: any) => ({
      ...trip,
      distance: calculateDistance(
        location.lat, location.lng,
        trip.pickup_lat, trip.pickup_lng
      ),
    }))
    .filter((trip: any) => trip.distance <= radiusKm)
    .sort((a: any, b: any) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Get active trip for user
 */
export async function getActiveTrip(
  supabase: SupabaseClient,
  userId: string
): Promise<any | null> {
  const result = await query(supabase, "trips")
    .select("id, status, role, vehicle_type, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, matched_driver_id, created_at")
    .eq("user_id", userId)
    .in("status", ["open", "matched", "started", "arrived", "picked_up", "in_progress"])
    .orderBy("created_at", "desc")
    .single();

  return result.data;
}

// ============================================================================
// INSURANCE QUERIES
// ============================================================================

/**
 * Get recent insurance lead
 */
export async function getRecentInsuranceLead(
  supabase: SupabaseClient,
  phone: string,
  windowMinutes: number = 15
): Promise<any | null> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const result = await query(supabase, "insurance_leads")
    .select("id, status, created_at")
    .eq("whatsapp", phone)
    .gte("created_at", windowStart)
    .orderBy("created_at", "desc")
    .single();

  return result.data;
}

/**
 * Get user claims
 */
export async function getUserClaims(
  supabase: SupabaseClient,
  phone: string,
  options: { limit?: number } = {}
): Promise<any[]> {
  const { limit = 10 } = options;

  const result = await query(supabase, "insurance_claims")
    .select("id, claim_type, status, submitted_at, reviewed_at, reviewer_comment")
    .eq("whatsapp", phone)
    .orderBy("submitted_at", "desc")
    .limit(limit)
    .execute();

  return result.data || [];
}

// ============================================================================
// WALLET QUERIES
// ============================================================================

/**
 * Get wallet balance (optimized)
 */
export async function getWalletBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const result = await query(supabase, "wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  return result.data?.balance || 0;
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<any[]> {
  const { limit = 10, offset = 0 } = options;

  const result = await query(supabase, "wallet_transactions")
    .select("id, type, amount, status, created_at, metadata")
    .eq("user_id", userId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return result.data || [];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
