/**
 * Call Status Webhook Handler
 *
 * Handle Meta WhatsApp Business Calling status callbacks.
 * Updates call_attempts status and triggers fallback on failure.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    CallStatusWebhookPayload,
    CallAttemptStatus,
} from './types';
import crypto from 'crypto';

// =============================================================================
// Status Mapping
// =============================================================================

const STATUS_MAP: Record<string, CallAttemptStatus> = {
    ringing: 'ringing',
    answered: 'answered',
    completed: 'completed',
    failed: 'failed',
    no_answer: 'no_answer',
    busy: 'busy',
};

// =============================================================================
// Fallback Messages
// =============================================================================

const FALLBACK_MESSAGES: Record<string, string> = {
    en: "The call didn't go through. I'll continue via chat.",
    fr: "L'appel n'a pas abouti. Je continue par chat.",
    rw: "Telefoni ntiyakunda. Nkomeza ubutumwa.",
};

// =============================================================================
// Webhook Handler
// =============================================================================

export interface CallStatusWebhookResult {
    processed: boolean;
    call_attempt_id?: string;
    new_status?: CallAttemptStatus;
    fallback_sent?: boolean;
    error?: string;
}

/**
 * Handle a call status webhook from Meta.
 */
export async function handleCallStatusWebhook(
    supabase: SupabaseClient,
    payload: CallStatusWebhookPayload,
    signature?: string,
    options?: {
        skipSignatureCheck?: boolean;
        appSecret?: string;
    }
): Promise<CallStatusWebhookResult> {
    // =========================================================================
    // Step 1: Verify signature (if provided)
    // =========================================================================
    if (!options?.skipSignatureCheck && signature && options?.appSecret) {
        const isValid = verifyWebhookSignature(payload, signature, options.appSecret);
        if (!isValid) {
            return { processed: false, error: 'Invalid signature' };
        }
    }

    // =========================================================================
    // Step 2: Extract call statuses
    // =========================================================================
    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const statuses = change.value?.statuses || [];

            for (const status of statuses) {
                const providerCallId = status.id;
                const newStatus = STATUS_MAP[status.status];

                if (!newStatus) {
                    console.warn(`[callStatusWebhook] Unknown status: ${status.status}`);
                    continue;
                }

                // Find the call attempt
                const { data: attempt, error } = await supabase
                    .from('moltbot_call_attempts')
                    .select('id, consent_id, status')
                    .eq('provider_call_id', providerCallId)
                    .maybeSingle();

                if (error || !attempt) {
                    console.warn(`[callStatusWebhook] Call attempt not found: ${providerCallId}`);
                    continue;
                }

                // Update the attempt
                const updateData: Record<string, unknown> = {
                    status: newStatus,
                };

                if (newStatus === 'answered') {
                    updateData.answered_at = new Date(parseInt(status.timestamp) * 1000).toISOString();
                }

                if (['completed', 'failed', 'no_answer', 'busy'].includes(newStatus)) {
                    updateData.ended_at = new Date(parseInt(status.timestamp) * 1000).toISOString();

                    // Store any errors
                    if (status.errors?.length) {
                        updateData.error_message = status.errors.map(e => `${e.code}: ${e.title}`).join('; ');
                    }
                }

                await supabase
                    .from('moltbot_call_attempts')
                    .update(updateData)
                    .eq('id', attempt.id);

                // =========================================================================
                // Step 3: Send fallback on failure
                // =========================================================================
                let fallbackSent = false;
                if (['failed', 'no_answer', 'busy'].includes(newStatus)) {
                    fallbackSent = await sendCallFallbackMessage(supabase, attempt.consent_id);
                }

                // Store raw payload for debugging
                await storeRawWebhook(supabase, attempt.id, payload);

                return {
                    processed: true,
                    call_attempt_id: attempt.id,
                    new_status: newStatus,
                    fallback_sent: fallbackSent,
                };
            }
        }
    }

    return { processed: false, error: 'No call statuses found in payload' };
}

// =============================================================================
// Helpers
// =============================================================================

function verifyWebhookSignature(
    payload: CallStatusWebhookPayload,
    signature: string,
    appSecret: string
): boolean {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', appSecret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(`sha256=${expectedSignature}`),
            Buffer.from(signature)
        );
    } catch {
        return false;
    }
}

async function sendCallFallbackMessage(
    supabase: SupabaseClient,
    consentId: string
): Promise<boolean> {
    // Get conversation from consent
    const { data: consent } = await supabase
        .from('moltbot_call_consents')
        .select('conversation_id')
        .eq('id', consentId)
        .single();

    if (!consent) return false;

    // Get conversation language
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('language')
        .eq('id', consent.conversation_id)
        .single();

    const language = conversation?.language || 'en';
    const message = FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES.en;

    // TODO: Wire to WhatsApp transport (Workflow 14)
    console.log(`[CALL] Sending fallback to ${consent.conversation_id}: ${message}`);

    return true;
}

async function storeRawWebhook(
    supabase: SupabaseClient,
    callAttemptId: string,
    payload: CallStatusWebhookPayload
): Promise<void> {
    // Store in audit log for debugging
    await supabase.from('moltbot_audit_logs').insert({
        event_type: 'call.webhook_received',
        details: {
            call_attempt_id: callAttemptId,
            raw_payload: payload,
        },
    });
}

// =============================================================================
// Webhook Verification (for initial Meta verification)
// =============================================================================

export function handleWebhookVerification(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
): { valid: boolean; response?: string } {
    if (mode === 'subscribe' && token === verifyToken) {
        return { valid: true, response: challenge };
    }
    return { valid: false };
}
