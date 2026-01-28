/**
 * WhatsApp Transport — Inbound Webhook Handler
 *
 * Entry point for Meta WhatsApp webhook requests.
 * Verifies signature, normalizes messages, and routes to orchestrator.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    MetaWebhookPayload,
    NormalizedInboundMessage,
    WhatsAppTransportError,
    getWhatsAppConfig,
} from './types';
import { normalizeInboundMessages, verifyWebhookSignature, fetchMediaUrl } from './normalizeInbound';
import { writeAuditEvent } from '../audit/writeAuditEvent';

// =============================================================================
// Types
// =============================================================================

export interface WebhookHandlerResult {
    success: boolean;
    processed: number;
    errors: string[];
}

export interface InboundMessageHandler {
    (
        supabase: SupabaseClient,
        message: NormalizedInboundMessage,
        conversationId: string,
        requestId?: string
    ): Promise<void>;
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle an inbound WhatsApp webhook request.
 *
 * @param supabase - Supabase client
 * @param rawBody - Raw request body as string
 * @param signature - X-Hub-Signature-256 header
 * @param onMessage - Handler for each normalized message
 * @returns Processing result
 */
export async function handleInboundWebhook(
    supabase: SupabaseClient,
    rawBody: string,
    signature: string,
    onMessage?: InboundMessageHandler
): Promise<WebhookHandlerResult> {
    const config = getWhatsAppConfig();
    const result: WebhookHandlerResult = {
        success: true,
        processed: 0,
        errors: [],
    };

    // =========================================================================
    // Step 1: Verify Signature
    // =========================================================================
    if (!verifyWebhookSignature(rawBody, signature, config.appSecret)) {
        await writeAuditEvent({
            event_type: 'whatsapp.webhook_signature_invalid',
            actor: 'system',
            input: { signature_prefix: signature?.slice(0, 20) },
            output: { rejected: true },
        });

        throw new WhatsAppTransportError('Invalid webhook signature', 'SIGNATURE_INVALID');
    }

    // =========================================================================
    // Step 2: Parse Payload
    // =========================================================================
    let payload: MetaWebhookPayload;
    try {
        payload = JSON.parse(rawBody) as MetaWebhookPayload;
    } catch {
        throw new WhatsAppTransportError('Invalid JSON payload', 'PAYLOAD_INVALID');
    }

    // =========================================================================
    // Step 3: Normalize Messages
    // =========================================================================
    const messages = normalizeInboundMessages(payload);

    if (messages.length === 0) {
        // No messages to process (might be status updates)
        return result;
    }

    // =========================================================================
    // Step 4: Process Each Message
    // =========================================================================
    for (const msg of messages) {
        try {
            // Fetch media URL if needed
            if (msg.media_url && !msg.media_url.startsWith('http')) {
                try {
                    msg.media_url = await fetchMediaUrl(msg.media_url, config.accessToken);
                } catch (error) {
                    console.error('[webhookInbound] Failed to fetch media URL:', error);
                    // Continue processing without media URL
                }
            }

            // Get or create conversation
            const conversationId = await getOrCreateConversation(supabase, msg.from_phone);

            // Idempotent message insert
            const insertResult = await insertMessageIdempotent(supabase, conversationId, msg);

            if (!insertResult.isNew) {
                // Duplicate message — skip processing
                continue;
            }

            // Audit inbound message
            await writeAuditEvent({
                event_type: 'whatsapp.message_received',
                actor: 'client',
                input: {
                    from_phone: msg.from_phone,
                    message_type: msg.message_type,
                    provider_message_id: msg.provider_message_id,
                },
                output: { conversation_id: conversationId, message_id: insertResult.id },
            });

            // Call message handler if provided
            if (onMessage) {
                await onMessage(supabase, msg, conversationId);
            }

            result.processed++;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Message ${msg.provider_message_id}: ${errorMsg}`);
            console.error('[webhookInbound] Error processing message:', error);
        }
    }

    result.success = result.errors.length === 0;
    return result;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get or create a conversation for a phone number.
 */
async function getOrCreateConversation(
    supabase: SupabaseClient,
    clientPhone: string
): Promise<string> {
    // Try to find existing conversation
    const { data: existing } = await supabase
        .from('moltbot_conversations')
        .select('id')
        .eq('client_phone', clientPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing) {
        return existing.id;
    }

    // Create new conversation
    const { data: created, error } = await supabase
        .from('moltbot_conversations')
        .insert({
            client_phone: clientPhone,
            language: 'en', // Default, will be updated by orchestrator
        })
        .select('id')
        .single();

    if (error) {
        throw new WhatsAppTransportError(
            `Failed to create conversation: ${error.message}`,
            'SEND_FAILED'
        );
    }

    return created.id;
}

/**
 * Insert a message idempotently.
 */
async function insertMessageIdempotent(
    supabase: SupabaseClient,
    conversationId: string,
    msg: NormalizedInboundMessage
): Promise<{ id: string; isNew: boolean }> {
    // Try insert
    const { data: inserted, error } = await supabase
        .from('moltbot_conversation_messages')
        .insert({
            conversation_id: conversationId,
            provider_message_id: msg.provider_message_id,
            direction: 'inbound',
            message_type: msg.message_type,
            body: msg.text_body,
            media_url: msg.media_url,
            media_mime_type: msg.media_mime_type,
            timestamp: msg.timestamp,
            metadata: {
                interactive_reply_id: msg.interactive_reply_id,
                interactive_reply_title: msg.interactive_reply_title,
            },
        })
        .select('id')
        .single();

    if (inserted) {
        return { id: inserted.id, isNew: true };
    }

    // Handle duplicate (unique constraint on provider_message_id)
    if (error?.code === '23505') {
        const { data: existing } = await supabase
            .from('moltbot_conversation_messages')
            .select('id')
            .eq('provider_message_id', msg.provider_message_id)
            .single();

        if (existing) {
            return { id: existing.id, isNew: false };
        }
    }

    throw new WhatsAppTransportError(`Failed to insert message: ${error?.message}`, 'SEND_FAILED');
}

// =============================================================================
// Webhook Verification (GET request)
// =============================================================================

/**
 * Handle Meta webhook verification (GET request).
 *
 * @param mode - hub.mode query param
 * @param token - hub.verify_token query param
 * @param challenge - hub.challenge query param
 * @returns Challenge string if valid, null otherwise
 */
export function verifyWebhookChallenge(
    mode: string,
    token: string,
    challenge: string
): string | null {
    const config = getWhatsAppConfig();

    if (mode === 'subscribe' && token === config.verifyToken) {
        return challenge;
    }

    return null;
}
