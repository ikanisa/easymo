/**
 * WhatsApp Transport — Call Status Webhook Handler
 *
 * Handles call status callbacks from Meta WhatsApp Business API.
 * Updates call_attempts and triggers fallback on failure.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    MetaCallWebhookPayload,
    CallStatus,
    WhatsAppTransportError,
} from './types';
import { sendTextMessage } from './sendMessage';
import { writeAuditEvent } from '../audit/writeAuditEvent';

// =============================================================================
// Types
// =============================================================================

export interface CallStatusHandlerResult {
    success: boolean;
    call_attempt_id?: string;
    fallback_sent?: boolean;
    error?: string;
}

// =============================================================================
// Status Mapping
// =============================================================================

const STATUS_MAP: Record<string, CallStatus> = {
    initiated: 'initiated',
    ringing: 'ringing',
    answered: 'answered',
    completed: 'completed',
    ended: 'completed',
    failed: 'failed',
    no_answer: 'no_answer',
    busy: 'busy',
    rejected: 'rejected',
};

// =============================================================================
// Fallback Messages
// =============================================================================

const FALLBACK_MESSAGES: Record<string, string> = {
    en: "I wasn't able to reach you by call. Let's continue via chat. How can I help?",
    fr: "Je n'ai pas pu vous joindre par appel. Continuons par chat. Comment puis-je vous aider ?",
    rw: "Sinashoboye kukugeraho ku itumanaho. Dukomeze kuri chat. Nagufasha nte?",
};

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle a call status webhook from Meta.
 *
 * @param supabase - Supabase client
 * @param payload - Call status payload
 * @returns Handler result
 */
export async function handleCallStatusWebhook(
    supabase: SupabaseClient,
    payload: MetaCallWebhookPayload
): Promise<CallStatusHandlerResult> {
    const { call_id, status, duration, error } = payload;

    // =========================================================================
    // Find Call Attempt
    // =========================================================================
    const { data: attempt, error: findError } = await supabase
        .from('moltbot_call_attempts')
        .select('id, consent_id, status')
        .eq('provider_call_id', call_id)
        .single();

    if (findError || !attempt) {
        console.warn('[callStatusWebhook] Unknown call_id:', call_id);
        return {
            success: false,
            error: `Unknown call_id: ${call_id}`,
        };
    }

    // =========================================================================
    // Map Status
    // =========================================================================
    const normalizedStatus = STATUS_MAP[status] || 'failed';
    const isTerminal = ['completed', 'failed', 'no_answer', 'busy', 'rejected'].includes(normalizedStatus);
    const isFailed = ['failed', 'no_answer', 'busy', 'rejected'].includes(normalizedStatus);

    // =========================================================================
    // Update Call Attempt
    // =========================================================================
    const updateData: Record<string, unknown> = {
        status: normalizedStatus,
        raw_status_payload: payload,
    };

    if (isTerminal) {
        updateData.ended_at = new Date().toISOString();
    }

    if (duration) {
        updateData.duration_seconds = duration;
    }

    if (error) {
        updateData.error_message = `${error.code}: ${error.message}`;
    }

    await supabase
        .from('moltbot_call_attempts')
        .update(updateData)
        .eq('id', attempt.id);

    // =========================================================================
    // Audit Log
    // =========================================================================
    await writeAuditEvent({
        event_type: `whatsapp.call_status_${normalizedStatus}`,
        actor: 'system',
        input: { call_id, original_status: status },
        output: {
            call_attempt_id: attempt.id,
            normalized_status: normalizedStatus,
            duration,
        },
    });

    // =========================================================================
    // Send Fallback on Failure
    // =========================================================================
    let fallbackSent = false;

    if (isFailed) {
        try {
            fallbackSent = await sendChatFallback(supabase, attempt.consent_id);
        } catch (e) {
            console.error('[callStatusWebhook] Failed to send fallback:', e);
        }
    }

    return {
        success: true,
        call_attempt_id: attempt.id,
        fallback_sent: fallbackSent,
    };
}

// =============================================================================
// Fallback Helper
// =============================================================================

async function sendChatFallback(
    supabase: SupabaseClient,
    consentId: string
): Promise<boolean> {
    // Get conversation from consent
    const { data: consent } = await supabase
        .from('moltbot_call_consents')
        .select('conversation_id')
        .eq('id', consentId)
        .single();

    if (!consent) {
        return false;
    }

    // Get conversation details
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('id, client_phone, language')
        .eq('id', consent.conversation_id)
        .single();

    if (!conversation) {
        return false;
    }

    // Get active request
    const { data: request } = await supabase
        .from('moltbot_marketplace_requests')
        .select('id')
        .eq('conversation_id', conversation.id)
        .neq('state', 'closed')
        .neq('state', 'handed_off')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!request) {
        return false;
    }

    // Send fallback message
    const language = conversation.language || 'en';
    const message = FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en;

    await sendTextMessage(
        supabase,
        conversation.id,
        request.id,
        conversation.client_phone,
        message
    );

    // Audit fallback
    await writeAuditEvent({
        request_id: request.id,
        event_type: 'whatsapp.call_fallback_sent',
        actor: 'system',
        input: { consent_id: consentId, language },
        output: { message_preview: message.slice(0, 50) },
    });

    return true;
}
