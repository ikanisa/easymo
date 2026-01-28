/**
 * Stop/Expand Controller Module
 * 
 * Determines when to stop outreach, expand to more vendors, or wait.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StopExpandDecision, ParsedVendorReply } from '@easymo/types';

// =============================================================================
// Types
// =============================================================================

export interface StopConditions {
    max_vendors: number;
    min_replies?: number;
    timeout_minutes?: number;
}

export interface EvaluationParams {
    request_id: string;
    stop_conditions: StopConditions;
    request_created_at: Date;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MIN_REPLIES = 3;
const DEFAULT_TIMEOUT_MINUTES = 30;

// =============================================================================
// Main Controller Function
// =============================================================================

/**
 * Evaluate whether to stop, expand, or wait for vendor replies.
 * 
 * @param supabase - Supabase client with service_role access
 * @param params - Evaluation parameters
 * @returns Decision on next action
 */
export async function evaluateStopExpand(
    supabase: SupabaseClient,
    params: EvaluationParams
): Promise<StopExpandDecision> {
    const { request_id, stop_conditions, request_created_at } = params;

    const minReplies = stop_conditions.min_replies ?? DEFAULT_MIN_REPLIES;
    const timeoutMinutes = stop_conditions.timeout_minutes ?? DEFAULT_TIMEOUT_MINUTES;
    const maxVendors = stop_conditions.max_vendors;

    // 1. Get outreach statistics
    const stats = await getOutreachStats(supabase, request_id);

    // 2. Check timeout
    const elapsedMinutes = (Date.now() - request_created_at.getTime()) / (1000 * 60);
    const isTimedOut = elapsedMinutes >= timeoutMinutes;

    // 3. Check if we have enough positive replies
    if (stats.in_stock_replies >= minReplies) {
        return {
            action: 'stop',
            reason: `Reached ${stats.in_stock_replies} in-stock replies (min: ${minReplies})`,
            ready_for_shortlist: true,
        };
    }

    // 4. Check timeout with partial results
    if (isTimedOut) {
        if (stats.in_stock_replies > 0) {
            return {
                action: 'timeout_proceed',
                reason: `Timeout after ${Math.round(elapsedMinutes)} minutes with ${stats.in_stock_replies} replies`,
                ready_for_shortlist: true,
            };
        }

        return {
            action: 'stop',
            reason: `Timeout after ${Math.round(elapsedMinutes)} minutes with no in-stock replies`,
            ready_for_shortlist: false,
        };
    }

    // 5. Check if we can expand
    if (stats.total_contacted < maxVendors) {
        const remainingSlots = maxVendors - stats.total_contacted;
        return {
            action: 'expand',
            reason: `${remainingSlots} vendor slots remaining, sending next batch`,
            ready_for_shortlist: false,
        };
    }

    // 6. Max vendors reached, still waiting
    if (stats.pending > 0) {
        return {
            action: 'wait',
            reason: `All ${maxVendors} vendors contacted, waiting for ${stats.pending} pending replies`,
            ready_for_shortlist: false,
        };
    }

    // 7. All vendors responded, not enough matches
    return {
        action: 'stop',
        reason: `All ${stats.total_contacted} vendors responded with ${stats.in_stock_replies} in-stock`,
        ready_for_shortlist: stats.in_stock_replies > 0,
    };
}

// =============================================================================
// Statistics Functions
// =============================================================================

interface OutreachStats {
    total_contacted: number;
    sent: number;
    replied: number;
    in_stock_replies: number;
    pending: number;
    failed: number;
}

async function getOutreachStats(
    supabase: SupabaseClient,
    requestId: string
): Promise<OutreachStats> {
    const { data: outreach, error } = await supabase
        .from('moltbot_vendor_outreach')
        .select('state, response_data')
        .eq('request_id', requestId);

    if (error) {
        console.error('[stop-expand-controller] Error fetching stats:', error);
        return {
            total_contacted: 0,
            sent: 0,
            replied: 0,
            in_stock_replies: 0,
            pending: 0,
            failed: 0,
        };
    }

    const records = outreach || [];

    // Count by state
    const sent = records.filter(r => r.state === 'sent').length;
    const replied = records.filter(r => r.state === 'replied').length;
    const failed = records.filter(r => r.state === 'failed' || r.state === 'no_response').length;
    const pending = records.filter(r => r.state === 'queued' || r.state === 'sent').length;

    // Count in-stock replies
    const in_stock_replies = records.filter(r => {
        if (r.state !== 'replied' || !r.response_data) return false;
        const parsed = r.response_data as Partial<ParsedVendorReply>;
        return parsed.availability === 'in_stock';
    }).length;

    return {
        total_contacted: records.length,
        sent,
        replied,
        in_stock_replies,
        pending,
        failed,
    };
}

// =============================================================================
// State Update Functions
// =============================================================================

/**
 * Update request state to shortlist_ready if decision allows.
 */
export async function applyStopExpandDecision(
    supabase: SupabaseClient,
    requestId: string,
    decision: StopExpandDecision
): Promise<void> {
    if (decision.ready_for_shortlist) {
        await supabase
            .from('moltbot_marketplace_requests')
            .update({ state: 'shortlist_ready' })
            .eq('id', requestId);

        console.log(`[stop-expand-controller] Request ${requestId} marked shortlist_ready`);
    }
}

/**
 * Get the request created timestamp.
 */
export async function getRequestCreatedAt(
    supabase: SupabaseClient,
    requestId: string
): Promise<Date | null> {
    const { data, error } = await supabase
        .from('moltbot_marketplace_requests')
        .select('created_at')
        .eq('id', requestId)
        .single();

    if (error || !data) {
        return null;
    }

    return new Date(data.created_at);
}
