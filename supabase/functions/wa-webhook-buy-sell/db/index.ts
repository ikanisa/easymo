/**
 * Marketplace Database Operations
 *
 * CRUD operations for marketplace listings, intents, and conversations.
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";

// =====================================================
// TYPES
// =====================================================

export interface MarketplaceListing {
  id?: string;
  seller_phone: string;
  seller_name?: string;
  listing_type: "product" | "service";
  title: string;
  product_name: string;
  description?: string;
  price?: number;
  price_negotiable?: boolean;
  currency?: string;
  lat?: number;
  lng?: number;
  location_text?: string;
  photos?: string[];
  attributes?: Record<string, unknown>;
  status?: "active" | "sold" | "expired" | "draft";
}

export interface BuyerIntent {
  id?: string;
  buyer_phone: string;
  looking_for: string;
  intent_type: "product" | "service" | "business";
  lat?: number;
  lng?: number;
  max_radius_km?: number;
  max_price?: number;
  min_price?: number;
  matched_listing_ids?: string[];
  status?: "active" | "fulfilled" | "expired";
}

export interface MarketplaceMatch {
  id?: string;
  listing_id: string;
  buyer_phone: string;
  seller_phone: string;
  distance_km?: number;
  match_score?: number;
  status?: "suggested" | "contacted" | "completed" | "rejected";
}

// =====================================================
// LISTINGS
// =====================================================

export async function createListing(
  supabase: SupabaseClient,
  listing: MarketplaceListing,
  correlationId?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("marketplace_listings")
      .insert({
        seller_phone: listing.seller_phone,
        seller_name: listing.seller_name,
        listing_type: listing.listing_type || "product",
        title: listing.title,
        product_name: listing.product_name,
        description: listing.description,
        price: listing.price,
        price_negotiable: listing.price_negotiable ?? true,
        currency: listing.currency || "RWF",
        lat: listing.lat,
        lng: listing.lng,
        location_text: listing.location_text,
        photos: listing.photos || [],
        attributes: listing.attributes || {},
        status: listing.status || "active",
      })
      .select("id")
      .single();

    if (error) {
      logStructuredEvent(
        "MARKETPLACE_DB_CREATE_LISTING_ERROR",
        { error: error.message, correlationId },
        "error",
      );
      return { success: false, error: error.message };
    }

    logStructuredEvent("MARKETPLACE_DB_LISTING_CREATED", {
      listingId: data.id,
      productName: listing.product_name,
      correlationId,
    });

    recordMetric("marketplace.db.listing.created", 1);

    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<MarketplaceListing | null> {
  const { data } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  return data;
}

export async function updateListing(
  supabase: SupabaseClient,
  listingId: string,
  updates: Partial<MarketplaceListing>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("marketplace_listings")
    .update(updates)
    .eq("id", listingId);

  if (error) {
    return { success: false, error: error.message };
  }

  recordMetric("marketplace.db.listing.updated", 1);
  return { success: true };
}

export async function getSellerListings(
  supabase: SupabaseClient,
  sellerPhone: string,
  status?: string,
): Promise<MarketplaceListing[]> {
  let query = supabase
    .from("marketplace_listings")
    .select("*")
    .eq("seller_phone", sellerPhone)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query.limit(20);
  return data || [];
}

export async function searchListings(
  supabase: SupabaseClient,
  searchTerm: string,
  options?: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
  },
): Promise<MarketplaceListing[]> {
  // If location is provided, use proximity search
  if (options?.lat && options?.lng) {
    const { data } = await supabase.rpc("search_marketplace_listings_nearby", {
      search_term: searchTerm,
      user_lat: options.lat,
      user_lng: options.lng,
      radius_km: options.radiusKm || 10,
      result_limit: options.limit || 10,
    });
    return data || [];
  }

  // Basic text search
  const { data } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "active")
    .textSearch("search_vector", searchTerm)
    .order("created_at", { ascending: false })
    .limit(options?.limit || 10);

  return data || [];
}

// =====================================================
// BUYER INTENTS
// =====================================================

export async function createBuyerIntent(
  supabase: SupabaseClient,
  intent: BuyerIntent,
  correlationId?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("marketplace_buyer_intents")
      .insert({
        buyer_phone: intent.buyer_phone,
        looking_for: intent.looking_for,
        intent_type: intent.intent_type || "product",
        lat: intent.lat,
        lng: intent.lng,
        max_radius_km: intent.max_radius_km || 10,
        max_price: intent.max_price,
        min_price: intent.min_price,
        matched_listing_ids: intent.matched_listing_ids || [],
        status: intent.status || "active",
      })
      .select("id")
      .single();

    if (error) {
      logStructuredEvent(
        "MARKETPLACE_DB_CREATE_INTENT_ERROR",
        { error: error.message, correlationId },
        "error",
      );
      return { success: false, error: error.message };
    }

    logStructuredEvent("MARKETPLACE_DB_INTENT_CREATED", {
      intentId: data.id,
      lookingFor: intent.looking_for,
      correlationId,
    });

    recordMetric("marketplace.db.intent.created", 1);

    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getBuyerIntent(
  supabase: SupabaseClient,
  intentId: string,
): Promise<BuyerIntent | null> {
  const { data } = await supabase
    .from("marketplace_buyer_intents")
    .select("*")
    .eq("id", intentId)
    .single();

  return data;
}

export async function updateBuyerIntent(
  supabase: SupabaseClient,
  intentId: string,
  updates: Partial<BuyerIntent>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("marketplace_buyer_intents")
    .update(updates)
    .eq("id", intentId);

  if (error) {
    return { success: false, error: error.message };
  }

  recordMetric("marketplace.db.intent.updated", 1);
  return { success: true };
}

export async function getActiveBuyerIntents(
  supabase: SupabaseClient,
  buyerPhone: string,
): Promise<BuyerIntent[]> {
  const { data } = await supabase
    .from("marketplace_buyer_intents")
    .select("*")
    .eq("buyer_phone", buyerPhone)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10);

  return data || [];
}

// =====================================================
// MATCHES
// =====================================================

export async function createMatch(
  supabase: SupabaseClient,
  match: MarketplaceMatch,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("marketplace_matches")
      .insert({
        listing_id: match.listing_id,
        buyer_phone: match.buyer_phone,
        seller_phone: match.seller_phone,
        distance_km: match.distance_km,
        match_score: match.match_score,
        status: match.status || "suggested",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    recordMetric("marketplace.db.match.created", 1);
    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateMatchStatus(
  supabase: SupabaseClient,
  matchId: string,
  status: "suggested" | "contacted" | "completed" | "rejected",
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("marketplace_matches")
    .update({ status })
    .eq("id", matchId);

  if (error) {
    return { success: false, error: error.message };
  }

  recordMetric("marketplace.db.match.status_updated", 1, { status });
  return { success: true };
}

export async function getMatchesForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<MarketplaceMatch[]> {
  const { data } = await supabase
    .from("marketplace_matches")
    .select("*")
    .eq("listing_id", listingId)
    .order("match_score", { ascending: false });

  return data || [];
}

export async function getMatchesForBuyer(
  supabase: SupabaseClient,
  buyerPhone: string,
): Promise<MarketplaceMatch[]> {
  const { data } = await supabase
    .from("marketplace_matches")
    .select("*, marketplace_listings(*)")
    .eq("buyer_phone", buyerPhone)
    .eq("status", "suggested")
    .order("match_score", { ascending: false })
    .limit(10);

  return data || [];
}

// =====================================================
// BUSINESS DIRECTORY SEARCH
// =====================================================

export async function searchBusinesses(
  supabase: SupabaseClient,
  searchTerm: string,
  options?: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
  },
): Promise<
  Array<{
    id: string;
    name: string;
    category: string;
    city: string;
    address: string;
    phone: string;
    rating: number;
    distance_km?: number;
  }>
> {
  // If location is provided, use proximity search
  if (options?.lat && options?.lng) {
    const { data } = await supabase.rpc("search_businesses_nearby", {
      search_term: searchTerm,
      user_lat: options.lat,
      user_lng: options.lng,
      radius_km: options.radiusKm || 10,
      result_limit: options.limit || 10,
    });
    return data || [];
  }

  // Basic text search
  const { data } = await supabase
    .from("businesses")
    .select("id, name, category, city, address, phone, rating")
    .neq("status", "inactive")
    .or(
      `name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`,
    )
    .order("rating", { ascending: false })
    .limit(options?.limit || 10);

  return data || [];
}
