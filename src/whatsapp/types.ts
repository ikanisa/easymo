/**
 * WhatsApp Transport Layer — Type Definitions
 *
 * Core interfaces for send/receive operations, webhook normalization,
 * and call initiation via Meta WhatsApp Business API.
 */

// =============================================================================
// Message Types
// =============================================================================

export type WhatsAppMessageType =
    | 'text'
    | 'image'
    | 'document'
    | 'audio'
    | 'video'
    | 'interactive'
    | 'location'
    | 'contacts';

export type InteractiveType = 'button' | 'list' | 'product' | 'product_list';

// =============================================================================
// Send Message
// =============================================================================

export interface SendMessageInput {
    /** Recipient phone number in E.164 format */
    to_phone: string;
    /** Message body (for text) or caption (for media) */
    text: string;
    /** Message type */
    message_type: 'text' | 'interactive';
    /** Unique key for idempotent delivery */
    idempotency_key: string;
    /** Associated marketplace request ID */
    request_id: string;
    /** Conversation ID */
    conversation_id: string;
    /** Optional interactive payload */
    interactive?: InteractivePayload;
}

export interface InteractivePayload {
    type: InteractiveType;
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: InteractiveAction;
}

export interface InteractiveAction {
    buttons?: Array<{
        type: 'reply';
        reply: { id: string; title: string };
    }>;
    sections?: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
    }>;
}

export interface SendMessageOutput {
    /** Provider (Meta) message ID */
    provider_message_id: string;
    /** Our internal message ID */
    conversation_message_id: string;
    /** Whether this was a cache hit (idempotent) */
    cached: boolean;
}

// =============================================================================
// Normalized Inbound Message
// =============================================================================

export interface NormalizedInboundMessage {
    /** Provider (Meta) message ID */
    provider_message_id: string;
    /** Sender phone number */
    from_phone: string;
    /** Normalized message type */
    message_type: WhatsAppMessageType;
    /** Text body (for text messages) */
    text_body?: string;
    /** Media URL (for media messages) */
    media_url?: string;
    /** MIME type for media */
    media_mime_type?: string;
    /** Interactive response ID (for button replies) */
    interactive_reply_id?: string;
    /** Interactive response title */
    interactive_reply_title?: string;
    /** Timestamp from provider */
    timestamp: string;
    /** Raw webhook payload for debugging */
    raw_payload: unknown;
}

// =============================================================================
// Call Types
// =============================================================================

export interface StartCallInput {
    /** Phone number to call */
    to_phone: string;
    /** Purpose/reason for the call */
    purpose: string;
    /** Consent record ID (must be granted) */
    consent_id: string;
    /** Unique key for idempotent call initiation */
    idempotency_key: string;
    /** Associated marketplace request ID */
    request_id: string;
}

export interface StartCallOutput {
    /** Success flag */
    success: boolean;
    /** Provider call ID */
    provider_call_id?: string;
    /** Our internal call attempt ID */
    call_attempt_id?: string;
    /** Error message if failed */
    error?: string;
}

export type CallStatus =
    | 'initiated'
    | 'ringing'
    | 'answered'
    | 'completed'
    | 'failed'
    | 'no_answer'
    | 'busy'
    | 'rejected';

// =============================================================================
// Webhook Payloads
// =============================================================================

export interface MetaWebhookPayload {
    object: 'whatsapp_business_account';
    entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
    id: string;
    changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
    value: {
        messaging_product: 'whatsapp';
        metadata: {
            display_phone_number: string;
            phone_number_id: string;
        };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: MetaInboundMessage[];
        statuses?: MetaMessageStatus[];
    };
    field: string;
}

export interface MetaInboundMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    image?: MetaMediaObject;
    document?: MetaMediaObject;
    audio?: MetaMediaObject;
    video?: MetaMediaObject;
    interactive?: {
        type: string;
        button_reply?: { id: string; title: string };
        list_reply?: { id: string; title: string; description?: string };
    };
}

export interface MetaMediaObject {
    id: string;
    mime_type: string;
    sha256?: string;
    caption?: string;
}

export interface MetaMessageStatus {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
    errors?: Array<{ code: number; title: string }>;
}

// =============================================================================
// Call Webhook
// =============================================================================

export interface MetaCallWebhookPayload {
    call_id: string;
    from: string;
    to: string;
    status: string;
    direction: 'inbound' | 'outbound';
    timestamp: string;
    duration?: number;
    error?: { code: string; message: string };
}

// =============================================================================
// Error Types
// =============================================================================

export type WhatsAppErrorCode =
    | 'SEND_FAILED'
    | 'INVALID_PHONE'
    | 'RATE_LIMITED'
    | 'MEDIA_FETCH_FAILED'
    | 'SIGNATURE_INVALID'
    | 'PAYLOAD_INVALID'
    | 'CALL_FAILED'
    | 'NO_CONSENT'
    | 'CONSENT_EXPIRED'
    | 'CALLING_DISABLED';

export class WhatsAppTransportError extends Error {
    constructor(
        message: string,
        public readonly code: WhatsAppErrorCode,
        public readonly retryable: boolean = false
    ) {
        super(message);
        this.name = 'WhatsAppTransportError';
    }
}

// =============================================================================
// Configuration
// =============================================================================

export interface WhatsAppConfig {
    /** Meta Cloud API base URL */
    apiUrl: string;
    /** Phone number ID for sending */
    phoneNumberId: string;
    /** Access token */
    accessToken: string;
    /** App secret for signature verification */
    appSecret: string;
    /** Webhook verify token */
    verifyToken: string;
}

export function getWhatsAppConfig(): WhatsAppConfig {
    const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    const appSecret = process.env.WHATSAPP_APP_SECRET || '';
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || '';

    return { apiUrl, phoneNumberId, accessToken, appSecret, verifyToken };
}
