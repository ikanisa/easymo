/**
 * Tool Executor — Execute Moltbot Actions via Tools
 *
 * All Moltbot actions are executed through this module.
 * No direct side-effects — everything goes through registered tools.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    MoltbotOutputAction,
    MoltbotActionAskClient,
    MoltbotActionVendorOutreachPlan,
    MoltbotActionShortlist,
    MoltbotActionEscalate,
} from '@easymo/types';
import { logAuditEvent } from './audit';
import { scheduleOutreachBatch } from '../../vendor';
import { requestCallConsent, startCall, CallingError } from '../../calling';
import { sendTextMessage, sendButtonMessage, sendMessage } from '../../whatsapp';

// =============================================================================
// Tool Executor
// =============================================================================

/**
 * Execute a Moltbot action using the appropriate tools.
 */
export async function executeToolAction(
    supabase: SupabaseClient,
    requestId: string,
    conversationId: string,
    action: MoltbotOutputAction
): Promise<void> {
    const idempotencyKey = generateIdempotencyKey(requestId, action);

    switch (action.type) {
        case 'ask_client':
            await executeAskClient(supabase, conversationId, action, idempotencyKey);
            break;

        case 'vendor_outreach_plan':
            await executeVendorOutreachPlan(supabase, requestId, conversationId, action, idempotencyKey);
            break;

        case 'shortlist':
            await executeShortlist(supabase, requestId, conversationId, action, idempotencyKey);
            break;

        case 'escalate':
            await executeEscalate(supabase, requestId, conversationId, action, idempotencyKey);
            break;

        case 'request_call_consent':
            await executeRequestCallConsent(supabase, requestId, action);
            break;

        case 'start_call':
            await executeStartCall(supabase, requestId, conversationId, action);
            break;
    }
}

// =============================================================================
// Action Executors
// =============================================================================

async function executeAskClient(
    supabase: SupabaseClient,
    conversationId: string,
    action: MoltbotActionAskClient,
    idempotencyKey: string
): Promise<void> {
    // Tool: marketplace.send_client_message
    await toolSendClientMessage(supabase, {
        conversation_id: conversationId,
        message: action.question_text,
        idempotency_key: idempotencyKey,
        options: action.options,
    });
}

async function executeVendorOutreachPlan(
    supabase: SupabaseClient,
    requestId: string,
    conversationId: string,
    action: MoltbotActionVendorOutreachPlan,
    _idempotencyKey: string
): Promise<void> {
    // Use new vendor outreach scheduler (Workflow 05)
    const result = await scheduleOutreachBatch(supabase, {
        request_id: requestId,
        conversation_id: conversationId,
        plan: action,
    });

    console.log(`[orchestrator] Vendor outreach scheduled: sent=${result.batch_sent}, queued=${result.total_queued}`);
}

async function executeShortlist(
    supabase: SupabaseClient,
    requestId: string,
    conversationId: string,
    action: MoltbotActionShortlist,
    idempotencyKey: string
): Promise<void> {
    // Import shortlist module
    const { formatShortlistForWhatsApp, performCloseout } = await import('../../shortlist');

    // Format messages for WhatsApp
    const candidates = action.items.map((item: (typeof action.items)[number]) => ({
        vendor_id: item.vendor_id,
        vendor_name: item.vendor_name,
        vendor_phone: item.vendor_phone,
        reply: {
            availability: (item.availability as 'in_stock' | 'out_of_stock' | 'unclear') ?? 'unclear',
            price_min: item.price,
            price_max: item.price,
            confidence: 0.7,
        },
        response_received_at: new Date(),
        scoring: {
            availability_score: 50,
            price_score: 10,
            distance_score: 0,
            confidence_score: 14,
            speed_score: 0,
            total: 74,
        },
    }));

    const formatted = formatShortlistForWhatsApp(candidates);

    // Send formatted messages to client
    for (const message of formatted.messages) {
        await toolSendClientMessage(supabase, {
            conversation_id: conversationId,
            message,
            idempotency_key: `${idempotencyKey}:msg:${formatted.messages.indexOf(message)}`,
        });
    }

    // Perform closeout: persist shortlist, transition states, cancel outreach
    const closeoutResult = await performCloseout(supabase, requestId, action.items);
    if (!closeoutResult.success) {
        console.error(`[orchestrator] Closeout failed: ${closeoutResult.error}`);
    } else {
        console.log(`[orchestrator] Shortlist closeout complete, cancelled ${closeoutResult.cancelled_outreach_count} outreach records`);
    }
}

// =============================================================================
// Calling Action Executors
// =============================================================================

interface RequestCallConsentAction {
    type: 'request_call_consent';
    scope: 'call_vendor' | 'call_client' | 'either' | 'concierge';
    reason?: string;
}

async function executeRequestCallConsent(
    supabase: SupabaseClient,
    requestId: string,
    action: RequestCallConsentAction
): Promise<void> {
    try {
        const result = await requestCallConsent(supabase, {
            request_id: requestId,
            scope: action.scope,
            reason: action.reason || '',
        });

        await logAuditEvent(supabase, {
            request_id: requestId,
            event_type: 'moltbot.call_consent_requested',
            details: { consent_id: result.consent_id, message_sent: result.message_sent },
        });
    } catch (error) {
        const errorMessage = error instanceof CallingError ? error.message : String(error);
        await logAuditEvent(supabase, {
            request_id: requestId,
            event_type: 'moltbot.call_consent_failed',
            details: { error: errorMessage },
        });
    }
}

interface StartCallAction {
    type: 'start_call';
    consent_id: string;
    target_phone?: string;
}

async function executeStartCall(
    supabase: SupabaseClient,
    requestId: string,
    conversationId: string,
    action: StartCallAction
): Promise<void> {
    try {
        const result = await startCall(supabase, {
            consent_id: action.consent_id,
            target_phone: action.target_phone,
        });

        await logAuditEvent(supabase, {
            request_id: requestId,
            event_type: 'moltbot.call_started',
            details: {
                call_attempt_id: result.call_attempt_id,
                provider_call_id: result.provider_call_id,
            },
        });
    } catch (error) {
        const errorMessage = error instanceof CallingError ? error.message : String(error);
        const errorCode = error instanceof CallingError ? error.code : 'UNKNOWN';

        await logAuditEvent(supabase, {
            request_id: requestId,
            event_type: 'moltbot.call_failed',
            details: { error: errorMessage, code: errorCode },
        });

        // Send fallback message if call failed
        await toolSendClientMessage(supabase, {
            conversation_id: conversationId,
            message: "The call didn't go through. I'll continue via chat.",
            idempotency_key: `call_fallback:${requestId}:${Date.now()}`,
        });
    }
}


async function executeEscalate(
    supabase: SupabaseClient,
    requestId: string,
    conversationId: string,
    action: MoltbotActionEscalate,
    idempotencyKey: string
): Promise<void> {
    // Log escalation reason
    await logAuditEvent(supabase, {
        request_id: requestId,
        event_type: 'moltbot.escalated',
        details: { reason: action.reason, to: action.to },
    });

    // Send safe message to client
    await toolSendClientMessage(supabase, {
        conversation_id: conversationId,
        message: action.safe_client_message,
        idempotency_key: idempotencyKey,
    });

    // Update state if suggested
    if (action.state_suggestion) {
        await toolUpdateRequestState(supabase, requestId, action.state_suggestion);
    }
}

// =============================================================================
// Tool Implementations (stubs — wire to actual transport)
// =============================================================================

interface SendClientMessageParams {
    conversation_id: string;
    message: string;
    idempotency_key: string;
    options?: string[];
}

async function toolSendClientMessage(
    supabase: SupabaseClient,
    params: SendClientMessageParams
): Promise<{ success: boolean; provider_message_id?: string }> {
    // Get conversation details
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('client_phone')
        .eq('id', params.conversation_id)
        .single();

    if (!conversation?.client_phone) {
        console.warn(`[TOOL] No phone for conversation ${params.conversation_id}`);
        return { success: false };
    }

    // Get request_id from a related request
    const { data: request } = await supabase
        .from('moltbot_marketplace_requests')
        .select('id')
        .eq('conversation_id', params.conversation_id)
        .neq('state', 'closed')
        .limit(1)
        .single();

    const requestId = request?.id || 'unknown';

    try {
        // Use buttons if options are provided
        let result;
        if (params.options && params.options.length > 0) {
            result = await sendButtonMessage(
                supabase,
                params.conversation_id,
                requestId,
                conversation.client_phone,
                params.message,
                params.options.map((opt, i) => ({ id: `opt_${i}`, title: opt.slice(0, 20) }))
            );
        } else {
            result = await sendTextMessage(
                supabase,
                params.conversation_id,
                requestId,
                conversation.client_phone,
                params.message
            );
        }

        return { success: true, provider_message_id: result.provider_message_id };
    } catch (error) {
        console.error('[TOOL] send_client_message failed:', error);
        return { success: false };
    }
}

interface SearchVendorsParams {
    request_id: string;
    category: string;
    filters?: {
        location_radius_km?: number;
        min_rating?: number;
        tags?: string[];
    };
    limit: number;
}

async function toolSearchVendors(
    supabase: SupabaseClient,
    params: SearchVendorsParams
): Promise<Array<{ vendor_id: string; name: string; phone: string }>> {
    // Query vendors table
    let query = supabase
        .from('vendors')
        .select('id, name, phone')
        .eq('is_active', true)
        .limit(params.limit);

    if (params.filters?.tags?.length) {
        query = query.contains('tags', params.filters.tags);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((v) => ({
        vendor_id: v.id,
        name: v.name,
        phone: v.phone,
    }));
}

interface SendVendorMessageParams {
    request_id: string;
    vendor_id: string;
    message: string;
    idempotency_key: string;
}

async function toolSendVendorMessage(
    supabase: SupabaseClient,
    params: SendVendorMessageParams
): Promise<{ success: boolean; outreach_id?: string }> {
    // Get vendor phone
    const { data: vendor } = await supabase
        .from('vendors')
        .select('phone')
        .eq('id', params.vendor_id)
        .single();

    if (!vendor?.phone) {
        console.warn(`[TOOL] No phone for vendor ${params.vendor_id}`);
        return { success: false };
    }

    // Insert into vendor outreach (idempotent via unique constraint)
    const { data, error } = await supabase
        .from('moltbot_vendor_outreach')
        .upsert(
            {
                request_id: params.request_id,
                vendor_id: params.vendor_id,
                outreach_message: params.message,
                state: 'queued',
            },
            { onConflict: 'request_id,vendor_id', ignoreDuplicates: true }
        )
        .select('id')
        .single();

    if (error && error.code !== '23505') {
        throw error;
    }

    // Send via WhatsApp transport
    try {
        await sendTextMessage(
            supabase,
            params.request_id, // Using request_id as conversation placeholder for vendor
            params.request_id,
            vendor.phone,
            params.message
        );

        // Update outreach state to sent
        if (data?.id) {
            await supabase
                .from('moltbot_vendor_outreach')
                .update({ state: 'sent', outreach_sent_at: new Date().toISOString() })
                .eq('id', data.id);
        }
    } catch (sendError) {
        console.error(`[TOOL] send_vendor_message failed for ${params.vendor_id}:`, sendError);
        // Mark outreach as failed
        if (data?.id) {
            await supabase
                .from('moltbot_vendor_outreach')
                .update({ state: 'failed' })
                .eq('id', data.id);
        }
        return { success: false, outreach_id: data?.id };
    }

    return { success: true, outreach_id: data?.id };
}

async function toolUpdateRequestState(
    supabase: SupabaseClient,
    requestId: string,
    newState: string
): Promise<void> {
    await supabase
        .from('moltbot_marketplace_requests')
        .update({ state: newState })
        .eq('id', requestId);
}

// =============================================================================
// Helpers
// =============================================================================

function generateIdempotencyKey(requestId: string, action: MoltbotOutputAction): string {
    const hash = simpleHash(JSON.stringify(action));
    return `request:${requestId}:action:${action.type}:hash:${hash}`;
}

function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}
