/**
 * Calling Tool Types
 *
 * Type definitions for WhatsApp Business Calling integration.
 * Follows tool-registry.v1.md contract.
 */

// =============================================================================
// Consent States (matches DB enum)
// =============================================================================

export type CallConsentState =
    | 'not_requested'
    | 'requested'
    | 'granted'
    | 'denied'
    | 'expired';

export type CallAttemptStatus =
    | 'initiated'
    | 'ringing'
    | 'answered'
    | 'completed'
    | 'failed'
    | 'no_answer'
    | 'busy';

export type CallScope = 'call_vendor' | 'call_client' | 'either' | 'concierge';

// =============================================================================
// Database Records
// =============================================================================

export interface CallConsentRecord {
    id: string;
    conversation_id: string;
    state: CallConsentState;
    scope: CallScope;
    requested_at: string | null;
    granted_at: string | null;
    denied_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CallAttemptRecord {
    id: string;
    consent_id: string;
    provider_call_id: string | null;
    status: CallAttemptStatus;
    duration_seconds: number | null;
    recording_url: string | null;
    error_message: string | null;
    initiated_at: string;
    answered_at: string | null;
    ended_at: string | null;
    created_at: string;
}

// =============================================================================
// Tool: marketplace.request_call_consent
// =============================================================================

export interface RequestCallConsentInput {
    request_id: string;
    scope: CallScope;
    reason: string; // Shown to client
}

export interface RequestCallConsentOutput {
    consent_id: string;
    state: 'requested';
    message_sent: boolean;
    error?: string;
}

// =============================================================================
// Tool: marketplace.start_call
// =============================================================================

export interface StartCallInput {
    consent_id: string;
    target_phone?: string; // Optional override (for vendor calls)
}

export interface StartCallOutput {
    success: boolean;
    call_attempt_id?: string;
    provider_call_id?: string;
    error?: string;
}

// =============================================================================
// Consent Handler
// =============================================================================

export interface HandleConsentReplyInput {
    conversation_id: string;
    message_body: string;
    provider_message_id: string;
}

export interface HandleConsentReplyOutput {
    matched: boolean;
    consent_id?: string;
    new_state?: CallConsentState;
    confirmation_sent?: boolean;
}

// =============================================================================
// Call Status Webhook (Meta)
// =============================================================================

export interface CallStatusWebhookPayload {
    object: 'whatsapp_business_account';
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: 'whatsapp';
                metadata: {
                    display_phone_number: string;
                    phone_number_id: string;
                };
                statuses?: Array<{
                    id: string;
                    status: 'ringing' | 'answered' | 'completed' | 'failed' | 'no_answer' | 'busy';
                    timestamp: string;
                    recipient_id: string;
                    errors?: Array<{
                        code: number;
                        title: string;
                    }>;
                }>;
            };
            field: string;
        }>;
    }>;
}

// =============================================================================
// Moltbot Context: Calling Policies
// =============================================================================

export interface CallingPolicies {
    enabled: boolean;
    consent_status: CallConsentState;
    consent_id?: string;
    allowed_scopes: CallScope[];
    cooldown_minutes: number;
    last_call_at?: string;
    can_call: boolean; // Pre-computed: enabled && consent_granted && !in_cooldown
}

// =============================================================================
// Error Types
// =============================================================================

export class CallingError extends Error {
    constructor(
        message: string,
        public readonly code: CallingErrorCode,
        public readonly retryable: boolean = false
    ) {
        super(message);
        this.name = 'CallingError';
    }
}

export type CallingErrorCode =
    | 'CALLING_DISABLED'
    | 'NO_CONSENT'
    | 'CONSENT_EXPIRED'
    | 'CONSENT_DENIED'
    | 'INVALID_STATE'
    | 'COOLDOWN_ACTIVE'
    | 'PROVIDER_ERROR'
    | 'ALREADY_IN_CALL';
