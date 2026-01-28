/**
 * WhatsApp Transport — Normalize Inbound Messages
 *
 * Converts raw Meta webhook payloads into a clean, normalized format.
 */

import {
    MetaWebhookPayload,
    MetaInboundMessage,
    NormalizedInboundMessage,
    WhatsAppMessageType,
    WhatsAppTransportError,
} from './types';

// =============================================================================
// Main Normalizer
// =============================================================================

/**
 * Extract and normalize inbound messages from a Meta webhook payload.
 *
 * @param payload - Raw Meta webhook payload
 * @returns Array of normalized inbound messages
 */
export function normalizeInboundMessages(
    payload: MetaWebhookPayload
): NormalizedInboundMessage[] {
    const results: NormalizedInboundMessage[] = [];

    if (payload.object !== 'whatsapp_business_account') {
        return results;
    }

    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const messages = change.value?.messages || [];
            for (const msg of messages) {
                try {
                    const normalized = normalizeSingleMessage(msg);
                    results.push(normalized);
                } catch (error) {
                    console.error('[normalizeInbound] Failed to normalize message:', error);
                }
            }
        }
    }

    return results;
}

/**
 * Normalize a single Meta inbound message.
 */
function normalizeSingleMessage(msg: MetaInboundMessage): NormalizedInboundMessage {
    const base: NormalizedInboundMessage = {
        provider_message_id: msg.id,
        from_phone: msg.from,
        message_type: normalizeMessageType(msg.type),
        timestamp: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
        raw_payload: msg,
    };

    // Text message
    if (msg.type === 'text' && msg.text) {
        base.text_body = msg.text.body;
    }

    // Image message
    if (msg.type === 'image' && msg.image) {
        base.media_url = msg.image.id; // Media ID, needs to be fetched
        base.media_mime_type = msg.image.mime_type;
        if (msg.image.caption) {
            base.text_body = msg.image.caption;
        }
    }

    // Document message
    if (msg.type === 'document' && msg.document) {
        base.media_url = msg.document.id;
        base.media_mime_type = msg.document.mime_type;
        if (msg.document.caption) {
            base.text_body = msg.document.caption;
        }
    }

    // Audio message
    if (msg.type === 'audio' && msg.audio) {
        base.media_url = msg.audio.id;
        base.media_mime_type = msg.audio.mime_type;
    }

    // Video message
    if (msg.type === 'video' && msg.video) {
        base.media_url = msg.video.id;
        base.media_mime_type = msg.video.mime_type;
        if (msg.video.caption) {
            base.text_body = msg.video.caption;
        }
    }

    // Interactive reply (button or list)
    if (msg.type === 'interactive' && msg.interactive) {
        const interactive = msg.interactive;
        if (interactive.button_reply) {
            base.interactive_reply_id = interactive.button_reply.id;
            base.interactive_reply_title = interactive.button_reply.title;
            base.text_body = interactive.button_reply.title;
        } else if (interactive.list_reply) {
            base.interactive_reply_id = interactive.list_reply.id;
            base.interactive_reply_title = interactive.list_reply.title;
            base.text_body = interactive.list_reply.title;
        }
    }

    return base;
}

/**
 * Normalize Meta message type to our internal type.
 */
function normalizeMessageType(metaType: string): WhatsAppMessageType {
    const typeMap: Record<string, WhatsAppMessageType> = {
        text: 'text',
        image: 'image',
        document: 'document',
        audio: 'audio',
        video: 'video',
        interactive: 'interactive',
        location: 'location',
        contacts: 'contacts',
    };

    return typeMap[metaType] || 'text';
}

// =============================================================================
// Media URL Fetcher
// =============================================================================

/**
 * Fetch the actual media URL from Meta using a media ID.
 *
 * @param mediaId - The media ID from the webhook
 * @param accessToken - Meta API access token
 * @returns The actual downloadable URL
 */
export async function fetchMediaUrl(
    mediaId: string,
    accessToken: string
): Promise<string> {
    const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';

    const response = await fetch(`${apiUrl}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new WhatsAppTransportError(
            `Failed to fetch media URL: ${response.status}`,
            'MEDIA_FETCH_FAILED'
        );
    }

    const data = await response.json() as { url: string };
    return data.url;
}

// =============================================================================
// Signature Verification
// =============================================================================

/**
 * Verify Meta webhook signature (HMAC-SHA256).
 *
 * @param payload - Raw request body as string
 * @param signature - X-Hub-Signature-256 header value
 * @param appSecret - WhatsApp app secret
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string
): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
        return false;
    }

    // Note: In production, use crypto.createHmac
    // This is a simplified version for the transport layer
    const crypto = require('crypto');
    const expectedSignature = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');

    const providedSignature = signature.slice(7); // Remove 'sha256=' prefix

    // Length check before timing-safe comparison
    if (expectedSignature.length !== providedSignature.length) {
        return false;
    }

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
    );
}
