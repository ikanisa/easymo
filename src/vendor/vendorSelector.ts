/**
 * Vendor Selector Module
 * 
 * Queries and ranks vendors based on eligibility filters and ranking criteria.
 * Follows rules defined in .agent/rules/40_vendor_selection.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface VendorSelectionParams {
    request_id: string;
    category: string;
    client_location?: { lat: number; lng: number };
    blocked_vendor_ids?: string[];
    already_contacted_ids?: string[];
    filters?: {
        location_radius_km?: number;
        min_rating?: number;
        tags?: string[];
    };
    limit: number;
}

export interface SelectedVendor {
    vendor_id: string;
    name: string;
    phone: string;
    distance_km?: number;
    match_score: number;
    rating?: number;
    avg_response_hours?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 15;
const MAX_VENDORS_PER_REQUEST = 15;

// =============================================================================
// Main Selection Function
// =============================================================================

/**
 * Select and rank eligible vendors for outreach.
 * 
 * @param supabase - Supabase client with service_role access
 * @param params - Selection parameters
 * @returns Ranked list of eligible vendors
 */
export async function selectVendors(
    supabase: SupabaseClient,
    params: VendorSelectionParams
): Promise<SelectedVendor[]> {
    const {
        category,
        client_location,
        blocked_vendor_ids = [],
        already_contacted_ids = [],
        filters = {},
        limit,
    } = params;

    const effectiveLimit = Math.min(limit, MAX_VENDORS_PER_REQUEST);
    const radiusKm = Math.min(filters.location_radius_km ?? DEFAULT_RADIUS_KM, MAX_RADIUS_KM);

    // Build base query
    let query = supabase
        .from('vendors')
        .select('id, name, phone, tags, rating, avg_response_hours, location')
        .eq('is_active', true)
        .not('phone', 'is', null);

    // Category filter (tags contain category)
    if (filters.tags?.length) {
        query = query.contains('tags', filters.tags);
    } else {
        query = query.contains('tags', [category]);
    }

    // Rating filter
    if (filters.min_rating) {
        query = query.gte('rating', filters.min_rating);
    }

    // Exclude blocked vendors
    if (blocked_vendor_ids.length > 0) {
        query = query.not('id', 'in', `(${blocked_vendor_ids.join(',')})`);
    }

    // Exclude already contacted vendors
    if (already_contacted_ids.length > 0) {
        query = query.not('id', 'in', `(${already_contacted_ids.join(',')})`);
    }

    // Execute query
    const { data: vendors, error } = await query;

    if (error) {
        console.error('[vendor-selector] Query error:', error);
        throw new Error(`Failed to query vendors: ${error.message}`);
    }

    if (!vendors || vendors.length === 0) {
        return [];
    }

    // Calculate scores and filter by distance
    const scoredVendors: SelectedVendor[] = [];

    for (const vendor of vendors) {
        let distance_km: number | undefined;

        // Calculate distance if client location available
        if (client_location && vendor.location) {
            distance_km = calculateDistanceKm(
                client_location.lat,
                client_location.lng,
                vendor.location.lat,
                vendor.location.lng
            );

            // Skip if outside radius
            if (distance_km > radiusKm) {
                continue;
            }
        }

        // Calculate match score
        const match_score = calculateMatchScore({
            category,
            vendor_tags: vendor.tags || [],
            distance_km,
            avg_response_hours: vendor.avg_response_hours,
            rating: vendor.rating,
        });

        scoredVendors.push({
            vendor_id: vendor.id,
            name: vendor.name,
            phone: vendor.phone,
            distance_km,
            match_score,
            rating: vendor.rating,
            avg_response_hours: vendor.avg_response_hours,
        });
    }

    // Sort by match_score descending and return top N
    scoredVendors.sort((a, b) => b.match_score - a.match_score);

    return scoredVendors.slice(0, effectiveLimit);
}

// =============================================================================
// Helper Functions
// =============================================================================

interface MatchScoreParams {
    category: string;
    vendor_tags: string[];
    distance_km?: number;
    avg_response_hours?: number;
    rating?: number;
}

/**
 * Calculate vendor match score (higher is better).
 * 
 * Scoring weights:
 * - Category match: 40 points (exact) / 20 points (partial)
 * - Distance: 30 points max (closer = higher)
 * - Response SLA: 20 points max (faster = higher)
 * - Rating: 10 points max
 */
function calculateMatchScore(params: MatchScoreParams): number {
    const { category, vendor_tags, distance_km, avg_response_hours, rating } = params;

    let score = 0;

    // Category match (40 max)
    const categoryLower = category.toLowerCase();
    const hasExactMatch = vendor_tags.some(tag => tag.toLowerCase() === categoryLower);
    const hasPartialMatch = vendor_tags.some(tag =>
        tag.toLowerCase().includes(categoryLower) || categoryLower.includes(tag.toLowerCase())
    );

    if (hasExactMatch) {
        score += 40;
    } else if (hasPartialMatch) {
        score += 20;
    }

    // Distance score (30 max, closer = higher)
    if (distance_km !== undefined) {
        const distanceScore = Math.max(0, 30 - (distance_km * 2));
        score += distanceScore;
    } else {
        // No location data, give neutral score
        score += 15;
    }

    // Response SLA score (20 max, faster = higher)
    if (avg_response_hours !== undefined) {
        const slaScore = Math.max(0, 20 - (avg_response_hours * 2));
        score += slaScore;
    } else {
        score += 10;
    }

    // Rating score (10 max)
    if (rating !== undefined) {
        score += Math.min(10, rating * 2);
    } else {
        score += 5;
    }

    return score;
}

/**
 * Calculate distance between two points using Haversine formula.
 */
function calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get list of vendor IDs already contacted for a request.
 */
export async function getAlreadyContactedVendorIds(
    supabase: SupabaseClient,
    requestId: string
): Promise<string[]> {
    const { data, error } = await supabase
        .from('moltbot_vendor_outreach')
        .select('vendor_id')
        .eq('request_id', requestId);

    if (error) {
        console.error('[vendor-selector] Error fetching contacted vendors:', error);
        return [];
    }

    return (data || []).map(row => row.vendor_id);
}

// =============================================================================
// Inventory-Based Selection (Taxonomy v1)
// =============================================================================

export interface InventorySelectionParams {
    request_id: string;
    category: string;
    subcategory?: string;
    tag?: string;
    brand?: string;
    model?: string;
    client_location?: { lat: number; lng: number };
    blocked_vendor_ids?: string[];
    already_contacted_ids?: string[];
    limit: number;
}

export interface InventoryMatchedVendor extends SelectedVendor {
    match_type: 'exact' | 'brand' | 'tag' | 'subcategory' | 'category';
    inventory_match_score: number;
    price_min?: number;
    price_max?: number;
}

const MIN_INVENTORY_MATCHES = 3;
const INVENTORY_MATCH_BOOST = 30;

/**
 * Select vendors with inventory tag matching.
 * 
 * Priority:
 * 1. Exact match (brand + model) → highest score
 * 2. Brand match → high score  
 * 3. Tag/subcategory match → medium score
 * 4. Fall back to category-only if < 3 inventory matches
 * 
 * @param supabase - Supabase client with service_role access
 * @param params - Selection parameters with taxonomy fields
 * @returns Ranked list of vendors with inventory match info
 */
export async function selectVendorsWithInventory(
    supabase: SupabaseClient,
    params: InventorySelectionParams
): Promise<InventoryMatchedVendor[]> {
    const {
        request_id,
        category,
        subcategory,
        tag,
        brand,
        model,
        client_location,
        blocked_vendor_ids = [],
        already_contacted_ids = [],
        limit,
    } = params;

    const effectiveLimit = Math.min(limit, MAX_VENDORS_PER_REQUEST);

    // Step 1: Query inventory tags using RPC function
    const { data: inventoryMatches, error: inventoryError } = await supabase
        .rpc('search_vendors_by_inventory', {
            p_category: category,
            p_subcategory: subcategory || null,
            p_tag: tag || null,
            p_brand: brand || null,
            p_model: model || null,
            p_limit: effectiveLimit,
        });

    if (inventoryError) {
        console.error('[vendor-selector] Inventory search error:', inventoryError);
        // Fall back to category-only selection
        return fallbackToCategorySelection(supabase, params);
    }

    // Filter out blocked and already contacted
    const excludeIds = new Set([...blocked_vendor_ids, ...already_contacted_ids]);
    const filteredMatches = (inventoryMatches || []).filter(
        (v: { vendor_id: string }) => !excludeIds.has(v.vendor_id)
    );

    // Step 2: If insufficient inventory matches, supplement with category-only
    if (filteredMatches.length < MIN_INVENTORY_MATCHES) {
        const supplemented = await supplementWithCategoryVendors(
            supabase,
            params,
            filteredMatches,
            effectiveLimit
        );
        return supplemented;
    }

    // Step 3: Enrich with distance and final scoring
    const enrichedVendors: InventoryMatchedVendor[] = [];

    for (const match of filteredMatches) {
        let distance_km: number | undefined;

        // Calculate distance if we have location data
        if (client_location) {
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('location')
                .eq('id', match.vendor_id)
                .single();

            if (vendorData?.location) {
                distance_km = calculateDistanceKm(
                    client_location.lat,
                    client_location.lng,
                    vendorData.location.lat,
                    vendorData.location.lng
                );
            }
        }

        // Calculate final score: inventory score + boost + distance adjustment
        const inventoryScore = match.match_score || 0;
        const distanceAdjustment = distance_km !== undefined
            ? Math.max(0, 30 - (distance_km * 2))
            : 15;

        const finalScore = inventoryScore + INVENTORY_MATCH_BOOST + distanceAdjustment;

        enrichedVendors.push({
            vendor_id: match.vendor_id,
            name: match.vendor_name,
            phone: match.vendor_phone,
            distance_km,
            match_score: finalScore,
            match_type: match.match_type,
            inventory_match_score: inventoryScore,
            price_min: match.price_min,
            price_max: match.price_max,
        });
    }

    // Sort by final score and return
    enrichedVendors.sort((a, b) => b.match_score - a.match_score);

    return enrichedVendors.slice(0, effectiveLimit);
}

/**
 * Fall back to category-only selection when inventory search fails.
 */
async function fallbackToCategorySelection(
    supabase: SupabaseClient,
    params: InventorySelectionParams
): Promise<InventoryMatchedVendor[]> {
    const categoryVendors = await selectVendors(supabase, {
        request_id: params.request_id,
        category: params.category,
        client_location: params.client_location,
        blocked_vendor_ids: params.blocked_vendor_ids,
        already_contacted_ids: params.already_contacted_ids,
        limit: params.limit,
    });

    return categoryVendors.map(v => ({
        ...v,
        match_type: 'category' as const,
        inventory_match_score: 0,
    }));
}

/**
 * Supplement inventory matches with category-only vendors.
 */
async function supplementWithCategoryVendors(
    supabase: SupabaseClient,
    params: InventorySelectionParams,
    existingMatches: Array<{ vendor_id: string; vendor_name: string; vendor_phone: string; match_type: string; match_score: number; price_min?: number; price_max?: number }>,
    targetCount: number
): Promise<InventoryMatchedVendor[]> {
    const existingIds = new Set(existingMatches.map(m => m.vendor_id));
    const remaining = targetCount - existingMatches.length;

    if (remaining <= 0) {
        // Convert existing matches to enriched format
        return existingMatches.map(m => ({
            vendor_id: m.vendor_id,
            name: m.vendor_name,
            phone: m.vendor_phone,
            match_score: m.match_score + INVENTORY_MATCH_BOOST,
            match_type: m.match_type as 'exact' | 'brand' | 'tag' | 'subcategory' | 'category',
            inventory_match_score: m.match_score,
            price_min: m.price_min,
            price_max: m.price_max,
        }));
    }

    // Get additional category-only vendors
    const additionalVendors = await selectVendors(supabase, {
        request_id: params.request_id,
        category: params.category,
        client_location: params.client_location,
        blocked_vendor_ids: [
            ...(params.blocked_vendor_ids || []),
            ...Array.from(existingIds),
        ],
        already_contacted_ids: params.already_contacted_ids,
        limit: remaining,
    });

    // Combine inventory matches (boosted) with category fallbacks
    const result: InventoryMatchedVendor[] = existingMatches.map(m => ({
        vendor_id: m.vendor_id,
        name: m.vendor_name,
        phone: m.vendor_phone,
        match_score: m.match_score + INVENTORY_MATCH_BOOST,
        match_type: m.match_type as 'exact' | 'brand' | 'tag' | 'subcategory' | 'category',
        inventory_match_score: m.match_score,
        price_min: m.price_min,
        price_max: m.price_max,
    }));

    for (const vendor of additionalVendors) {
        result.push({
            ...vendor,
            match_type: 'category',
            inventory_match_score: 0,
        });
    }

    // Sort by score
    result.sort((a, b) => b.match_score - a.match_score);

    return result.slice(0, targetCount);
}
