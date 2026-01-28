/**
 * WhatsApp Transport — Send Message
 *
 * Idempotent outbound messaging via Meta Cloud API.
 * Writes conversation_messages and audit_events for every send.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { writeAuditEvent } from '../audit/writeAuditEvent';
import {
    SendMessageInput,
    SendMessageOutput,
    WhatsAppTransportError,
    getWhatsAppConfig,
    InteractivePayload,
} from './types';

// =============================================================================
// Main Send Function
// =============================================================================

/**
 * Send a WhatsApp message with idempotency and audit logging.
 *
 * If the same idempotency_key has already succeeded, returns the existing IDs.
 *
 * @param supabase - Supabase client with service_role access
 * @param input - Message input
 * @returns Message output with IDs
 */
export async function sendMessage(
    supabase: SupabaseClient,
    input: SendMessageInput
): Promise<SendMessageOutput> {
    const { to_phone, text, message_type, idempotency_key, request_id, conversation_id, interactive } = input;

    // =========================================================================
    // Idempotency Check
    // =========================================================================
    const { data: existing } = await supabase
        .from('moltbot_conversation_messages')
        .select('id, provider_message_id')
        .eq('idempotency_key', idempotency_key)
        .eq('direction', 'outbound')
        .maybeSingle();

    if (existing && existing.provider_message_id) {
        // Already sent — return cached result
        return {
            provider_message_id: existing.provider_message_id,
            conversation_message_id: existing.id,
            cached: true,
        };
    }

    // =========================================================================
    // Create Pending Message Record
    // =========================================================================
    const now = new Date().toISOString();

    const { data: messageRow, error: insertError } = await supabase
        .from('moltbot_conversation_messages')
        .insert({
            conversation_id,
            direction: 'outbound',
            message_type,
            body: text,
            idempotency_key,
            timestamp: now,
            metadata: { request_id },
        })
        .select('id')
        .single();

    if (insertError) {
        // Check if idempotency collision (race condition)
        if (insertError.code === '23505') {
            // Another process won — fetch and return
            const { data: raced } = await supabase
                .from('moltbot_conversation_messages')
                .select('id, provider_message_id')
                .eq('idempotency_key', idempotency_key)
                .single();

            if (raced?.provider_message_id) {
                return {
                    provider_message_id: raced.provider_message_id,
                    conversation_message_id: raced.id,
                    cached: true,
                };
            }
        }
        throw new WhatsAppTransportError(`Failed to create message record: ${insertError.message}`, 'SEND_FAILED');
    }

    // =========================================================================
    // Send via Meta API
    // =========================================================================
    let providerMessageId: string;

    try {
        providerMessageId = await sendViaMetaApi(to_phone, text, message_type, interactive);
    } catch (error) {
        // Update message record with error
        await supabase
            .from('moltbot_conversation_messages')
            .update({
                metadata: {
                    request_id,
                    error: error instanceof Error ? error.message : String(error),
                },
            })
            .eq('id', messageRow.id);

        // Audit the failure
        await writeAuditEvent({
            request_id,
            event_type: 'whatsapp.send_failed',
            actor: 'system',
            input: { to_phone, message_type, idempotency_key },
            output: { error: error instanceof Error ? error.message : String(error) },
        });

        throw error;
    }

    // =========================================================================
    // Update Message Record with Provider ID
    // =========================================================================
    await supabase
        .from('moltbot_conversation_messages')
        .update({ provider_message_id: providerMessageId })
        .eq('id', messageRow.id);

    // =========================================================================
    // Audit Log
    // =========================================================================
    await writeAuditEvent({
        request_id,
        event_type: 'whatsapp.message_sent',
        actor: 'system',
        input: { to_phone, message_type, idempotency_key },
        output: { provider_message_id: providerMessageId, conversation_message_id: messageRow.id },
    });

    return {
        provider_message_id: providerMessageId,
        conversation_message_id: messageRow.id,
        cached: false,
    };
}

// =============================================================================
// Meta API Sender
// =============================================================================

async function sendViaMetaApi(
    toPhone: string,
    text: string,
    messageType: 'text' | 'interactive',
    interactive?: InteractivePayload
): Promise<string> {
    const config = getWhatsAppConfig();

    if (!config.accessToken || !config.phoneNumberId) {
        throw new WhatsAppTransportError(
            'WhatsApp API not configured (missing access token or phone number ID)',
            'SEND_FAILED'
        );
    }

    const url = `${config.apiUrl}/${config.phoneNumberId}/messages`;

    // Build request body
    let body: Record<string, unknown>;

    if (messageType === 'interactive' && interactive) {
        body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'interactive',
            interactive,
        };
    } else {
        body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'text',
            text: { preview_url: false, body: text },
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();

        // Check for rate limiting
        if (response.status === 429) {
            throw new WhatsAppTransportError(
                `Rate limited: ${errorText}`,
                'RATE_LIMITED',
                true // Retryable
            );
        }

        throw new WhatsAppTransportError(
            `Meta API error (${response.status}): ${errorText}`,
            'SEND_FAILED'
        );
    }

    const data = await response.json() as { messages: Array<{ id: string }> };

    if (!data.messages?.[0]?.id) {
        throw new WhatsAppTransportError('No message ID in Meta response', 'SEND_FAILED');
    }

    return data.messages[0].id;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Send a simple text message.
 */
export async function sendTextMessage(
    supabase: SupabaseClient,
    conversationId: string,
    requestId: string,
    toPhone: string,
    text: string
): Promise<SendMessageOutput> {
    const idempotencyKey = `${requestId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    return sendMessage(supabase, {
        to_phone: toPhone,
        text,
        message_type: 'text',
        idempotency_key: idempotencyKey,
        request_id: requestId,
        conversation_id: conversationId,
    });
}

/**
 * Send an interactive button message.
 */
export async function sendButtonMessage(
    supabase: SupabaseClient,
    conversationId: string,
    requestId: string,
    toPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
): Promise<SendMessageOutput> {
    const idempotencyKey = `${requestId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    return sendMessage(supabase, {
        to_phone: toPhone,
        text: bodyText,
        message_type: 'interactive',
        idempotency_key: idempotencyKey,
        request_id: requestId,
        conversation_id: conversationId,
        interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
                buttons: buttons.slice(0, 3).map((b) => ({
                    type: 'reply' as const,
                    reply: { id: b.id, title: b.title.slice(0, 20) },
                })),
            },
        },
    });
}
