/**
 * Outreach Scheduler Module
 * 
 * Orchestrates vendor outreach in batches with idempotency.
 * Follows rules defined in .agent/rules/40_vendor_selection.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MoltbotActionVendorOutreachPlan } from '@easymo/types';
import { selectVendors, getAlreadyContactedVendorIds } from './vendorSelector';
import { sendTextMessage } from '../whatsapp';

// =============================================================================
// Types
// =============================================================================

export interface OutreachSchedulerParams {
    request_id: string;
    conversation_id: string;
    plan: MoltbotActionVendorOutreachPlan;
    client_location?: { lat: number; lng: number };
}

export interface OutreachResult {
    batch_sent: number;
    total_queued: number;
    duplicates_skipped: number;
    vendors_messaged: Array<{ vendor_id: string; name: string }>;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_BATCH_SIZE = 5;

// =============================================================================
// Main Scheduler Function
// =============================================================================

/**
 * Schedule a batch of vendor outreach.
 * 
 * @param supabase - Supabase client with service_role access
 * @param params - Scheduler parameters including the vendor outreach plan
 * @returns Result of the batch operation
 */
export async function scheduleOutreachBatch(
    supabase: SupabaseClient,
    params: OutreachSchedulerParams
): Promise<OutreachResult> {
    const { request_id, plan, client_location } = params;

    // 1. Verify request state
    const { data: request, error: reqError } = await supabase
        .from('moltbot_marketplace_requests')
        .select('state')
        .eq('id', request_id)
        .single();

    if (reqError || !request) {
        throw new Error(`Request ${request_id} not found`);
    }

    const validStates = ['vendor_outreach', 'awaiting_vendor_replies', 'collecting_requirements'];
    if (!validStates.includes(request.state)) {
        throw new Error(`Invalid request state for outreach: ${request.state}`);
    }

    // 2. Get already contacted vendors
    const alreadyContacted = await getAlreadyContactedVendorIds(supabase, request_id);

    // 3. Select candidate vendors
    const batchSize = Math.min(plan.batch_size, MAX_BATCH_SIZE);
    const candidates = await selectVendors(supabase, {
        request_id,
        category: plan.category,
        client_location,
        already_contacted_ids: alreadyContacted,
        filters: plan.vendor_filters,
        limit: batchSize,
    });

    if (candidates.length === 0) {
        return {
            batch_sent: 0,
            total_queued: alreadyContacted.length,
            duplicates_skipped: 0,
            vendors_messaged: [],
        };
    }

    // 4. Build outreach message
    const outreachMessage = buildVendorMessage(plan);

    // 5. Queue outreach for each vendor (with idempotency)
    const result: OutreachResult = {
        batch_sent: 0,
        total_queued: alreadyContacted.length,
        duplicates_skipped: 0,
        vendors_messaged: [],
    };

    for (const vendor of candidates) {
        const queueResult = await queueVendorOutreach(supabase, {
            request_id,
            vendor_id: vendor.vendor_id,
            outreach_message: outreachMessage,
        });

        if (queueResult.is_new) {
            result.batch_sent++;
            result.vendors_messaged.push({
                vendor_id: vendor.vendor_id,
                name: vendor.name,
            });

            // Send via WhatsApp transport
            try {
                await sendTextMessage(
                    supabase,
                    request_id, // conversation placeholder for vendor comms
                    request_id,
                    vendor.phone,
                    outreachMessage
                );

                // Mark as sent
                await supabase
                    .from('moltbot_vendor_outreach')
                    .update({ state: 'sent', outreach_sent_at: new Date().toISOString() })
                    .eq('id', queueResult.id);
            } catch (sendError) {
                console.error(`[outreach-scheduler] Failed to send to ${vendor.name}:`, sendError);
                // Mark as failed
                await supabase
                    .from('moltbot_vendor_outreach')
                    .update({ state: 'failed' })
                    .eq('id', queueResult.id);
            }
        } else {
            result.duplicates_skipped++;
        }
    }

    result.total_queued = alreadyContacted.length + result.batch_sent;

    // 6. Update request state to awaiting_vendor_replies
    if (result.batch_sent > 0) {
        await supabase
            .from('moltbot_marketplace_requests')
            .update({ state: 'awaiting_vendor_replies' })
            .eq('id', request_id);
    }

    console.log(`[outreach-scheduler] Batch complete for ${request_id}: sent=${result.batch_sent}, skipped=${result.duplicates_skipped}`);

    return result;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build the vendor outreach message from plan.
 */
function buildVendorMessage(plan: MoltbotActionVendorOutreachPlan): string {
    const questions = plan.vendor_questions.length > 0
        ? plan.vendor_questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
        : `1. In stock? (yes/no)\n2. Price range? (RWF)\n3. Your location/landmark?\n4. Any options (color/model)?`;

    return `Hi! 👋 EasyMO request:

Client needs: ${plan.normalized_need}
Category: ${plan.category}

Questions:
${questions}

Reply example: "1. yes 2. 15k-20k 3. Kimironko 4. black or white"`;
}

/**
 * Queue vendor outreach idempotently using unique constraint.
 */
async function queueVendorOutreach(
    supabase: SupabaseClient,
    outreach: {
        request_id: string;
        vendor_id: string;
        outreach_message: string;
    }
): Promise<{ id: string; is_new: boolean }> {
    // Try insert; unique constraint on (request_id, vendor_id) handles dedupe
    const { data: inserted, error: insertError } = await supabase
        .from('moltbot_vendor_outreach')
        .insert({
            request_id: outreach.request_id,
            vendor_id: outreach.vendor_id,
            outreach_message: outreach.outreach_message,
            state: 'queued',
        })
        .select('id')
        .single();

    if (inserted) {
        return { id: inserted.id, is_new: true };
    }

    // If insert failed due to duplicate, fetch the existing row
    if (insertError?.code === '23505') {
        const { data: existing } = await supabase
            .from('moltbot_vendor_outreach')
            .select('id')
            .eq('request_id', outreach.request_id)
            .eq('vendor_id', outreach.vendor_id)
            .single();

        if (existing) {
            return { id: existing.id, is_new: false };
        }
    }

    console.error('[outreach-scheduler] Failed to queue outreach:', insertError);
    throw new Error(`Failed to queue vendor outreach: ${insertError?.message}`);
}

// =============================================================================
// Exported Utilities
// =============================================================================

/**
 * Get total vendor outreach count for a request.
 */
export async function getOutreachCount(
    supabase: SupabaseClient,
    requestId: string
): Promise<number> {
    const { count, error } = await supabase
        .from('moltbot_vendor_outreach')
        .select('*', { count: 'exact', head: true })
        .eq('request_id', requestId);

    if (error) {
        console.error('[outreach-scheduler] Error counting outreach:', error);
        return 0;
    }

    return count ?? 0;
}
