/**
 * Shortlist Module Types
 *
 * Type definitions for shortlist generation, scoring, and formatting.
 */

import type { ParsedVendorReply, MoltbotShortlistItem, MoltbotPolicyFlags } from '@easymo/types';

// =============================================================================
// Scoring Types
// =============================================================================

/**
 * Configuration for scoring weights.
 * All weights are positive numbers; negative scores come from specific conditions.
 */
export interface ShortlistRankConfig {
    /** Weight for availability score */
    availability: {
        in_stock: number;
        unclear: number;
        out_of_stock: number;
    };
    /** Weight for price fit */
    priceFit: {
        withinBudget: number;
        slightlyAbove: number;
        noBudget: number;
    };
    /** Weight for distance */
    distance: {
        within2km: number;
        within5km: number;
        within10km: number;
    };
    /** Confidence multiplier (confidence × this value) */
    confidenceMultiplier: number;
    /** Response speed bonuses */
    responseSpeed: {
        firstResponder: number;
        within10min: number;
        within30min: number;
    };
}

/**
 * Default scoring configuration based on rule 50_shortlist_ranking.md
 */
export const DEFAULT_RANK_CONFIG: ShortlistRankConfig = {
    availability: {
        in_stock: 50,
        unclear: 10,
        out_of_stock: -100,
    },
    priceFit: {
        withinBudget: 20,
        slightlyAbove: 5,
        noBudget: 10,
    },
    distance: {
        within2km: 15,
        within5km: 10,
        within10km: 5,
    },
    confidenceMultiplier: 20,
    responseSpeed: {
        firstResponder: 10,
        within10min: 8,
        within30min: 5,
    },
};

/**
 * Vendor candidate with scoring breakdown for transparency
 */
export interface ShortlistCandidate {
    vendor_id: string;
    vendor_name: string;
    vendor_phone: string;
    /** Parsed vendor reply data */
    reply: ParsedVendorReply;
    /** Response timestamp */
    response_received_at: Date;
    /** Distance in km (if known) */
    distance_km?: number;
    /** Scoring breakdown */
    scoring: {
        availability_score: number;
        price_score: number;
        distance_score: number;
        confidence_score: number;
        speed_score: number;
        total: number;
    };
    /** Location note from vendor */
    location_note?: string;
}

/**
 * Client constraints for price filtering
 */
export interface ClientConstraints {
    budget_min?: number;
    budget_max?: number;
    preferred_location?: string;
}

/**
 * Context pack sent to Moltbot for shortlist generation
 */
export interface ShortlistPack {
    /** Request ID from marketplace_requests table */
    request_id: string;
    /** Normalized need description */
    normalized_need: string;
    /** Client's constraints */
    client_constraints: ClientConstraints;
    /** Top N candidates with scoring breakdown */
    ranked_candidates: ShortlistCandidate[];
    /** Policy flags */
    policies: Pick<MoltbotPolicyFlags, 'calling_enabled' | 'ai_enabled'>;
    /** Handoff mode */
    handoff_mode: 'wa_link' | 'phone';
    /** Client language */
    language: string;
}

// =============================================================================
// WhatsApp Formatting Types
// =============================================================================

/**
 * A single formatted vendor entry for WhatsApp
 */
export interface FormattedVendorEntry {
    /** Display name */
    name: string;
    /** Price range string (e.g., "15k-30k RWF") */
    price_range: string;
    /** Stock status (e.g., "In stock", "Check availability") */
    stock_status: string;
    /** Location string */
    location: string;
    /** wa.me link for direct WhatsApp contact */
    wa_link: string;
}

/**
 * Formatted shortlist ready for WhatsApp
 */
export interface FormattedShortlist {
    /** Summary text (intro line) */
    summary: string;
    /** Formatted vendor entries (max 5) */
    vendors: FormattedVendorEntry[];
    /** Messages to send (1-2 max) */
    messages: string[];
    /** Closing line */
    closing: string;
}

// =============================================================================
// Closeout Types
// =============================================================================

/**
 * Result of closeout operation
 */
export interface CloseoutResult {
    success: boolean;
    /** Number of pending outreach records cancelled */
    cancelled_outreach_count: number;
    /** Error message if failed */
    error?: string;
    /** Audit event IDs created */
    audit_event_ids: string[];
}
