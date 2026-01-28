/**
 * Shortlist Closeout Module
 *
 * Handles state transitions and cleanup when shortlist is delivered.
 * Implements rules from 51_closeout_rules.md.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MoltbotShortlistItem, MoltbotRequestState } from '@easymo/types';
import type { CloseoutResult } from './types';

// =============================================================================
// Main Closeout Function
// =============================================================================

/**
 * Perform shortlist closeout: persist, transition state, cancel outreach.
 * This operation is idempotent — safe to call multiple times.
 */
export async function performCloseout(
    supabase: SupabaseClient,
    requestId: string,
    shortlist: MoltbotShortlistItem[]
): Promise<CloseoutResult> {
    const auditEventIds: string[] = [];

    try {
        // Step 1: Persist shortlist and transition to shortlist_ready
        const persistResult = await persistShortlist(supabase, requestId, shortlist);
        if (!persistResult.success) {
            return {
                success: false,
                cancelled_outreach_count: 0,
                error: `Failed to persist shortlist: ${persistResult.error}`,
                audit_event_ids: auditEventIds,
            };
        }

        // Log shortlist generation
        const genEventId = await logCloseoutEvent(supabase, requestId, 'shortlist.generated', {
            vendor_count: shortlist.length,
            vendor_ids: shortlist.map((v) => v.vendor_id),
        });
        if (genEventId) auditEventIds.push(genEventId);

        // Step 2: Transition to handed_off
        const transitionResult = await transitionToHandedOff(supabase, requestId);
        if (!transitionResult.success) {
            // Log warning but don't fail — shortlist is already saved
            console.warn(`[closeout] Failed to transition to handed_off: ${transitionResult.error}`);
        } else {
            const handoffEventId = await logCloseoutEvent(supabase, requestId, 'shortlist.handoff', {});
            if (handoffEventId) auditEventIds.push(handoffEventId);
        }

        // Step 3: Cancel pending outreach
        const cancelledCount = await cancelPendingOutreach(supabase, requestId);
        if (cancelledCount > 0) {
            const cancelEventId = await logCloseoutEvent(supabase, requestId, 'shortlist.outreach_cancelled', {
                cancelled_count: cancelledCount,
            });
            if (cancelEventId) auditEventIds.push(cancelEventId);
        }

        return {
            success: true,
            cancelled_outreach_count: cancelledCount,
            audit_event_ids: auditEventIds,
        };
    } catch (error) {
        console.error('[closeout] Unexpected error:', error);
        return {
            success: false,
            cancelled_outreach_count: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            audit_event_ids: auditEventIds,
        };
    }
}

// =============================================================================
// Persist Shortlist
// =============================================================================

interface PersistResult {
    success: boolean;
    error?: string;
}

async function persistShortlist(
    supabase: SupabaseClient,
    requestId: string,
    shortlist: MoltbotShortlistItem[]
): Promise<PersistResult> {
    // Idempotent: use conditional update
    const { error } = await supabase
        .from('moltbot_marketplace_requests')
        .update({
            shortlist,
            state: 'shortlist_ready' as MoltbotRequestState,
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .in('state', ['awaiting_vendor_replies', 'shortlist_ready']); // Only update if in expected states

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

// =============================================================================
// State Transition
// =============================================================================

interface TransitionResult {
    success: boolean;
    error?: string;
}

async function transitionToHandedOff(
    supabase: SupabaseClient,
    requestId: string
): Promise<TransitionResult> {
    // Idempotent: only transition if in shortlist_ready
    const { error } = await supabase
        .from('moltbot_marketplace_requests')
        .update({
            state: 'handed_off' as MoltbotRequestState,
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('state', 'shortlist_ready');

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

// =============================================================================
// Cancel Pending Outreach
// =============================================================================

/**
 * Cancel all pending vendor outreach for a request.
 * Returns the number of records updated.
 */
export async function cancelPendingOutreach(
    supabase: SupabaseClient,
    requestId: string
): Promise<number> {
    const { data, error } = await supabase
        .from('moltbot_vendor_outreach')
        .update({
            state: 'excluded',
            updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId)
        .in('state', ['queued', 'sent'])
        .select('id');

    if (error) {
        console.error('[closeout] Error cancelling outreach:', error);
        return 0;
    }

    return data?.length ?? 0;
}

// =============================================================================
// Check Request State
// =============================================================================

/**
 * Check if a request has been handed off (for scheduler to skip).
 */
export async function isRequestHandedOff(
    supabase: SupabaseClient,
    requestId: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from('moltbot_marketplace_requests')
        .select('state')
        .eq('id', requestId)
        .single();

    if (error || !data) {
        return false;
    }

    return data.state === 'handed_off' || data.state === 'closed';
}

// =============================================================================
// Audit Logging
// =============================================================================

async function logCloseoutEvent(
    supabase: SupabaseClient,
    requestId: string,
    eventType: string,
    details: Record<string, unknown>
): Promise<string | null> {
    const { data, error } = await supabase
        .from('moltbot_audit_log')
        .insert({
            request_id: requestId,
            event_type: eventType,
            details,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) {
        console.error('[closeout] Error logging audit event:', error);
        return null;
    }

    return data?.id ?? null;
}
