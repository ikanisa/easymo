/**
 * Build Shortlist Pack Module
 *
 * Assembles context pack for Moltbot to generate shortlist output.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    MoltbotVendorOutreach,
    ParsedVendorReply,
    MoltbotPolicyFlags,
} from '@easymo/types';
import type { ShortlistPack, ShortlistCandidate, ClientConstraints } from './types';
import { scoreVendorReply, rankCandidates } from './scoring';

// =============================================================================
// Main Builder Function
// =============================================================================

/**
 * Build a shortlist pack for Moltbot consumption.
 */
export async function buildShortlistPack(
    supabase: SupabaseClient,
    requestId: string,
    options: {
        maxCandidates?: number;
        language?: string;
    } = {}
): Promise<ShortlistPack | null> {
    const maxCandidates = options.maxCandidates ?? 5;
    const language = options.language ?? 'en';

    // 1. Fetch request details
    const request = await fetchRequest(supabase, requestId);
    if (!request) {
        console.error(`[shortlist-pack] Request ${requestId} not found`);
        return null;
    }

    // 2. Fetch vendor replies
    const outreachRecords = await fetchVendorReplies(supabase, requestId);
    if (outreachRecords.length === 0) {
        console.warn(`[shortlist-pack] No vendor replies for request ${requestId}`);
        return null;
    }

    // 3. Fetch vendor details
    const vendorIds = outreachRecords.map((o) => o.vendor_id);
    const vendors = await fetchVendors(supabase, vendorIds);

    // 4. Extract client constraints
    const clientConstraints = extractClientConstraints(request.requirements);

    // 5. Score and rank candidates
    const requestCreatedAt = new Date(request.created_at);
    let isFirstResponder = true;

    const candidates: ShortlistCandidate[] = outreachRecords
        .filter((o) => o.response_data && Object.keys(o.response_data).length > 0)
        .map((outreach) => {
            const vendor = vendors.get(outreach.vendor_id);
            const reply = outreach.response_data as ParsedVendorReply;
            const responseTime = outreach.response_received_at
                ? new Date(outreach.response_received_at)
                : new Date();

            const candidate = scoreVendorReply({
                vendor_id: outreach.vendor_id,
                vendor_name: vendor?.name ?? 'Unknown Vendor',
                vendor_phone: vendor?.phone ?? '',
                reply,
                response_received_at: responseTime,
                request_created_at: requestCreatedAt,
                is_first_responder: isFirstResponder,
                client_constraints: clientConstraints,
                // TODO: Add distance calculation when location data is available
            });

            isFirstResponder = false;
            return candidate;
        });

    // 6. Rank and limit
    const rankedCandidates = rankCandidates(candidates, {
        maxItems: maxCandidates,
        excludeOutOfStock: true,
    });

    // 7. Fetch policies
    const policies = await fetchPolicies(supabase);

    return {
        request_id: requestId,
        normalized_need: extractNormalizedNeed(request.requirements),
        client_constraints: clientConstraints,
        ranked_candidates: rankedCandidates,
        policies: {
            calling_enabled: policies.calling_enabled,
            ai_enabled: policies.ai_enabled,
        },
        handoff_mode: 'wa_link',
        language,
    };
}

// =============================================================================
// Data Fetchers
// =============================================================================

interface RequestRecord {
    id: string;
    requirements: Record<string, unknown>;
    created_at: string;
}

async function fetchRequest(
    supabase: SupabaseClient,
    requestId: string
): Promise<RequestRecord | null> {
    const { data, error } = await supabase
        .from('moltbot_marketplace_requests')
        .select('id, requirements, created_at')
        .eq('id', requestId)
        .single();

    if (error || !data) {
        return null;
    }

    return data as RequestRecord;
}

async function fetchVendorReplies(
    supabase: SupabaseClient,
    requestId: string
): Promise<MoltbotVendorOutreach[]> {
    const { data, error } = await supabase
        .from('moltbot_vendor_outreach')
        .select('*')
        .eq('request_id', requestId)
        .eq('state', 'replied');

    if (error) {
        console.error('[shortlist-pack] Error fetching vendor replies:', error);
        return [];
    }

    return (data || []) as MoltbotVendorOutreach[];
}

interface VendorRecord {
    id: string;
    name: string;
    phone: string;
}

async function fetchVendors(
    supabase: SupabaseClient,
    vendorIds: string[]
): Promise<Map<string, VendorRecord>> {
    if (vendorIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('vendors')
        .select('id, name, phone')
        .in('id', vendorIds);

    if (error) {
        console.error('[shortlist-pack] Error fetching vendors:', error);
        return new Map();
    }

    const vendorMap = new Map<string, VendorRecord>();
    for (const vendor of data || []) {
        vendorMap.set(vendor.id, vendor as VendorRecord);
    }

    return vendorMap;
}

async function fetchPolicies(
    _supabase: SupabaseClient
): Promise<MoltbotPolicyFlags> {
    // TODO: Fetch from configuration table or environment
    return {
        calling_enabled: false,
        ocr_enabled: true,
        ai_enabled: true,
        max_vendors_per_request: 15,
        vendor_reply_timeout_hours: 1,
    };
}

// =============================================================================
// Extractors
// =============================================================================

function extractClientConstraints(
    requirements: Record<string, unknown>
): ClientConstraints {
    return {
        budget_min: typeof requirements.budget_min === 'number'
            ? requirements.budget_min
            : undefined,
        budget_max: typeof requirements.budget_max === 'number'
            ? requirements.budget_max
            : undefined,
        preferred_location: typeof requirements.location === 'string'
            ? requirements.location
            : undefined,
    };
}

function extractNormalizedNeed(requirements: Record<string, unknown>): string {
    // Extract normalized need from requirements
    if (typeof requirements.normalized_need === 'string') {
        return requirements.normalized_need;
    }

    // Fallback: build from product/category
    const parts: string[] = [];

    if (typeof requirements.product === 'string') {
        parts.push(requirements.product);
    }
    if (typeof requirements.category === 'string') {
        parts.push(`(${requirements.category})`);
    }

    return parts.join(' ') || 'Product request';
}
