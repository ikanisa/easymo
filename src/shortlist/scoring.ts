/**
 * Vendor Reply Scoring Module
 *
 * Scores vendor replies according to ranking rules in 50_shortlist_ranking.md.
 */

import type { ParsedVendorReply } from '@easymo/types';
import type {
    ShortlistRankConfig,
    ShortlistCandidate,
    ClientConstraints,
} from './types';
import { DEFAULT_RANK_CONFIG } from './types';

// =============================================================================
// Main Scoring Function
// =============================================================================

/**
 * Score a vendor reply and return a candidate with scoring breakdown.
 */
export function scoreVendorReply(params: {
    vendor_id: string;
    vendor_name: string;
    vendor_phone: string;
    reply: ParsedVendorReply;
    response_received_at: Date;
    request_created_at: Date;
    is_first_responder: boolean;
    distance_km?: number;
    client_constraints?: ClientConstraints;
    config?: ShortlistRankConfig;
}): ShortlistCandidate {
    const config = params.config ?? DEFAULT_RANK_CONFIG;

    // Calculate individual scores
    const availability_score = scoreAvailability(params.reply.availability, config);
    const price_score = scorePriceFit(params.reply, params.client_constraints, config);
    const distance_score = scoreDistance(params.distance_km, config);
    const confidence_score = scoreConfidence(params.reply.confidence, config);
    const speed_score = scoreResponseSpeed(
        params.response_received_at,
        params.request_created_at,
        params.is_first_responder,
        config
    );

    const total =
        availability_score +
        price_score +
        distance_score +
        confidence_score +
        speed_score;

    return {
        vendor_id: params.vendor_id,
        vendor_name: params.vendor_name,
        vendor_phone: params.vendor_phone,
        reply: params.reply,
        response_received_at: params.response_received_at,
        distance_km: params.distance_km,
        location_note: params.reply.location_note,
        scoring: {
            availability_score,
            price_score,
            distance_score,
            confidence_score,
            speed_score,
            total,
        },
    };
}

// =============================================================================
// Individual Score Functions
// =============================================================================

function scoreAvailability(
    availability: ParsedVendorReply['availability'],
    config: ShortlistRankConfig
): number {
    switch (availability) {
        case 'in_stock':
            return config.availability.in_stock;
        case 'unclear':
            return config.availability.unclear;
        case 'out_of_stock':
            return config.availability.out_of_stock;
        default:
            return 0;
    }
}

function scorePriceFit(
    reply: ParsedVendorReply,
    constraints: ClientConstraints | undefined,
    config: ShortlistRankConfig
): number {
    // No price in reply
    if (reply.price_min === undefined && reply.price_max === undefined) {
        return 0;
    }

    // No budget constraint from client
    if (!constraints?.budget_max) {
        return config.priceFit.noBudget;
    }

    const vendorMax = reply.price_max ?? reply.price_min ?? 0;
    const clientMax = constraints.budget_max;

    // Within budget
    if (vendorMax <= clientMax) {
        return config.priceFit.withinBudget;
    }

    // Slightly above (≤20% over)
    if (vendorMax <= clientMax * 1.2) {
        return config.priceFit.slightlyAbove;
    }

    // Too expensive
    return 0;
}

function scoreDistance(
    distance_km: number | undefined,
    config: ShortlistRankConfig
): number {
    if (distance_km === undefined) {
        return 0;
    }

    if (distance_km <= 2) {
        return config.distance.within2km;
    }
    if (distance_km <= 5) {
        return config.distance.within5km;
    }
    if (distance_km <= 10) {
        return config.distance.within10km;
    }

    return 0;
}

function scoreConfidence(
    confidence: number,
    config: ShortlistRankConfig
): number {
    // Confidence is 0.0–1.0
    return Math.round(confidence * config.confidenceMultiplier);
}

function scoreResponseSpeed(
    responseTime: Date,
    requestCreatedAt: Date,
    isFirstResponder: boolean,
    config: ShortlistRankConfig
): number {
    if (isFirstResponder) {
        return config.responseSpeed.firstResponder;
    }

    const elapsedMinutes =
        (responseTime.getTime() - requestCreatedAt.getTime()) / (1000 * 60);

    if (elapsedMinutes <= 10) {
        return config.responseSpeed.within10min;
    }
    if (elapsedMinutes <= 30) {
        return config.responseSpeed.within30min;
    }

    return 0;
}

// =============================================================================
// Ranking and Filtering
// =============================================================================

/**
 * Rank candidates by score and apply hard constraints.
 */
export function rankCandidates(
    candidates: ShortlistCandidate[],
    options: {
        maxItems?: number;
        excludeOutOfStock?: boolean;
    } = {}
): ShortlistCandidate[] {
    const maxItems = options.maxItems ?? 5;
    const excludeOutOfStock = options.excludeOutOfStock ?? true;

    let filtered = [...candidates];

    // Apply hard constraint: exclude out_of_stock if alternatives exist
    if (excludeOutOfStock) {
        filtered = applyOutOfStockConstraint(filtered);
    }

    // Sort by total score descending, then by tiebreakers
    filtered.sort((a, b) => {
        // Primary: total score
        if (b.scoring.total !== a.scoring.total) {
            return b.scoring.total - a.scoring.total;
        }

        // Tiebreaker 1: higher confidence
        if (b.reply.confidence !== a.reply.confidence) {
            return b.reply.confidence - a.reply.confidence;
        }

        // Tiebreaker 2: lower price
        const aPrice = a.reply.price_min ?? Infinity;
        const bPrice = b.reply.price_min ?? Infinity;
        if (aPrice !== bPrice) {
            return aPrice - bPrice;
        }

        // Tiebreaker 3: faster response
        return (
            a.response_received_at.getTime() - b.response_received_at.getTime()
        );
    });

    // Limit to max items
    return filtered.slice(0, maxItems);
}

/**
 * Apply hard constraint: exclude out_of_stock vendors when alternatives exist.
 */
export function applyOutOfStockConstraint(
    candidates: ShortlistCandidate[]
): ShortlistCandidate[] {
    const inStockOrUnclear = candidates.filter(
        (c) => c.reply.availability !== 'out_of_stock'
    );

    // If we have alternatives, exclude out_of_stock
    if (inStockOrUnclear.length > 0) {
        return inStockOrUnclear;
    }

    // No alternatives — keep all (even out_of_stock) but they'll score low
    return candidates;
}
