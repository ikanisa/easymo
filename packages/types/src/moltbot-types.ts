/**
 * Moltbot Conversation Backbone Types
 * 
 * Type definitions for the WhatsApp concierge state machine,
 * context packs, and vendor outreach tracking.
 */

// =============================================================================
// State Machine Enums
// =============================================================================

/**
 * Request lifecycle states (client-facing)
 */
export type MoltbotRequestState =
    | 'collecting_requirements'
    | 'ocr_processing'
    | 'vendor_outreach'
    | 'awaiting_vendor_replies'
    | 'shortlist_ready'
    | 'handed_off'
    | 'closed'
    | 'error';

/**
 * Vendor outreach states (per vendor)
 */
export type MoltbotVendorOutreachState =
    | 'queued'
    | 'sent'
    | 'replied'
    | 'no_response'
    | 'failed'
    | 'excluded';

/**
 * Call consent states
 */
export type MoltbotCallConsentState =
    | 'not_requested'
    | 'requested'
    | 'granted'
    | 'denied'
    | 'expired';

// =============================================================================
// Database Row Types
// =============================================================================

export interface MoltbotConversation {
    id: string;
    channel: 'whatsapp' | string;
    client_phone: string;
    language: string;
    status: 'active' | 'closed' | 'archived';
    created_at: string;
    updated_at: string;
    last_message_at: string | null;
}

export interface MoltbotConversationMessage {
    id: string;
    conversation_id: string;
    provider_message_id: string;
    direction: 'inbound' | 'outbound';
    message_type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'interactive' | 'template';
    body: string | null;
    media_url: string | null;
    media_mime_type: string | null;
    metadata: Record<string, unknown>;
    timestamp: string;
    created_at: string;
}

export interface MoltbotMarketplaceRequest {
    id: string;
    conversation_id: string;
    state: MoltbotRequestState;
    requirements: Record<string, unknown>;
    shortlist: MoltbotShortlistItem[];
    error_reason: string | null;
    fallback_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface MoltbotOcrJob {
    id: string;
    request_id: string;
    message_id: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    provider: string;
    media_url: string;
    media_type: string | null;
    extracted: Record<string, unknown>;
    confidence: number | null;
    raw_response: Record<string, unknown> | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface MoltbotVendorOutreach {
    id: string;
    request_id: string;
    vendor_id: string;
    state: MoltbotVendorOutreachState;
    outreach_message: string | null;
    outreach_sent_at: string | null;
    response_message: string | null;
    response_received_at: string | null;
    response_data: Record<string, unknown>;
    attempts: number;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface MoltbotCallConsent {
    id: string;
    conversation_id: string;
    state: MoltbotCallConsentState;
    scope: string;
    requested_at: string | null;
    granted_at: string | null;
    denied_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface MoltbotCallAttempt {
    id: string;
    consent_id: string;
    provider_call_id: string | null;
    status: 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed' | 'no_answer' | 'busy';
    duration_seconds: number | null;
    recording_url: string | null;
    error_message: string | null;
    initiated_at: string;
    answered_at: string | null;
    ended_at: string | null;
    created_at: string;
}

// =============================================================================
// Context Pack (sent to Moltbot)
// =============================================================================

export interface MoltbotShortlistItem {
    vendor_id: string;
    vendor_name: string;
    vendor_phone: string;
    response_summary: string;
    price?: number;
    availability?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Moltbot Shortlist Prompt Contract
 * 
 * Documents constraints for Moltbot when generating shortlist output.
 * These rules MUST be followed to ensure consistent, safe output.
 */
export interface MoltbotShortlistPromptContract {
    /**
     * Maximum number of vendors in shortlist output.
     * Hard limit: 5 vendors maximum.
     */
    max_items: 5;

    /**
     * Field constraints:
     * - Only use fields from ParsedVendorReply (no invention)
     * - Include vendor_name, vendor_phone, price range, availability, location
     * - Never include client PII in shortlist
     */
    allowed_fields: readonly ['vendor_name', 'vendor_phone', 'price_min', 'price_max', 'availability', 'location_note'];

    /**
     * Confidence rules:
     * - Assign confidence based on vendor reply evidence only
     * - High (0.8+): clear availability + price + location
     * - Medium (0.5-0.8): clear availability + one other field
     * - Low (<0.5): unclear or missing fields
     */
    confidence_rules: 'evidence_based';

    /**
     * Summary text requirements:
     * - Brief and action-oriented
     * - Include count of options found
     * - Reference client's original need
     * - Max 100 characters
     */
    summary_max_length: 100;

    /**
     * Handoff mode:
     * - Always include wa.me links for direct vendor contact
     * - Never include client phone in handoff
     */
    handoff_mode: 'wa_link';
}

/**
 * Default shortlist prompt contract values
 */
export const SHORTLIST_CONTRACT: MoltbotShortlistPromptContract = {
    max_items: 5,
    allowed_fields: ['vendor_name', 'vendor_phone', 'price_min', 'price_max', 'availability', 'location_note'] as const,
    confidence_rules: 'evidence_based',
    summary_max_length: 100,
    handoff_mode: 'wa_link',
};

export interface MoltbotOcrResult {
    job_id: string;
    status: MoltbotOcrJob['status'];
    extracted: Record<string, unknown>;
    confidence: number | null;
}

export interface MoltbotVendorOutreachSummary {
    total_vendors: number;
    queued: number;
    sent: number;
    replied: number;
    no_response: number;
    failed: number;
    excluded: number;
}

/**
 * Parsed vendor reply from WhatsApp message
 */
export interface ParsedVendorReply {
    availability: 'in_stock' | 'out_of_stock' | 'unclear';
    price_min?: number;
    price_max?: number;
    location_note?: string;
    options?: string[];
    confidence: number;
    warnings?: string[];
}

/**
 * Decision from stop/expand controller
 */
export interface StopExpandDecision {
    action: 'stop' | 'expand' | 'wait' | 'timeout_proceed';
    reason: string;
    ready_for_shortlist: boolean;
}

export interface MoltbotPolicyFlags {
    calling_enabled: boolean;
    ocr_enabled: boolean;
    ai_enabled: boolean;
    max_vendors_per_request: number;
    vendor_reply_timeout_hours: number;
}

/**
 * Style constraints for Moltbot output.
 * Enforces concise, consistent messaging.
 */
export interface MoltbotStyleConstraints {
    /** Maximum questions Moltbot should ask per turn */
    max_questions_per_turn: number;
    /** Whether to enforce concise output */
    concise: boolean;
}

/**
 * Context Pack sent to Moltbot for decision-making.
 * This is the minimal, clean input that Moltbot receives.
 */
export interface MoltbotContextPack {
    /** Request ID from marketplace_requests table */
    request_id: string;

    /** Conversation ID */
    conversation_id: string;

    /** Client's preferred language (e.g., 'en', 'fr', 'rw') */
    language: string;

    /** Current state in the request lifecycle */
    request_state: MoltbotRequestState;

    /** Structured requirements collected from user + OCR */
    requirements: Record<string, unknown>;

    /** Last N messages (typically 10-20), with secrets redacted */
    last_messages: Pick<MoltbotConversationMessage, 'direction' | 'body' | 'timestamp' | 'message_type'>[];

    /** Latest OCR result (if any) */
    ocr?: MoltbotOcrResult;

    /** Summary of vendor outreach status */
    vendor_outreach_summary: MoltbotVendorOutreachSummary;

    /** Policy flags for this request */
    policies: MoltbotPolicyFlags;

    /** Style constraints for output formatting */
    style_constraints: MoltbotStyleConstraints;
}


// =============================================================================
// Moltbot Output Contract (v1)
// =============================================================================

/**
 * Ask client for clarification or more information
 */
export interface MoltbotActionAskClient {
    type: 'ask_client';
    question_text: string;
    why: string;
    options?: string[];
    state_suggestion?: MoltbotRequestState;
}

/**
 * Plan vendor outreach for the request
 */
export interface MoltbotActionVendorOutreachPlan {
    type: 'vendor_outreach_plan';
    category: string;
    normalized_need: string;
    vendor_filters?: {
        location_radius_km?: number;
        min_rating?: number;
        tags?: string[];
    };
    batch_size: number; // max 5
    vendor_questions: string[];
    stop_conditions: {
        max_vendors: number; // max 15
        min_replies?: number;
        timeout_hours?: number;
    };
    calling_allowed: boolean;
}

/**
 * Present shortlist to client
 */
export interface MoltbotActionShortlist {
    type: 'shortlist';
    summary_text: string;
    items: MoltbotShortlistItem[];
    handoff: {
        type: 'wa_link' | 'phone';
        message_template?: string;
    };
}

/**
 * Escalate to human or fallback
 */
export interface MoltbotActionEscalate {
    type: 'escalate';
    reason: string;
    safe_client_message: string;
    state_suggestion?: MoltbotRequestState;
    to?: 'human' | 'fallback';
}

/**
 * Moltbot output contract — exactly one of these action types.
 */
export type MoltbotOutputAction =
    | MoltbotActionAskClient
    | MoltbotActionVendorOutreachPlan
    | MoltbotActionShortlist
    | MoltbotActionEscalate;

/**
 * Validate Moltbot output against contract.
 * Returns { valid: true, action } or { valid: false, error }.
 */
export function validateMoltbotOutput(
    output: unknown
): { valid: true; action: MoltbotOutputAction } | { valid: false; error: string } {
    if (!output || typeof output !== 'object') {
        return { valid: false, error: 'Output must be an object' };
    }

    const obj = output as Record<string, unknown>;

    if (!obj.type || typeof obj.type !== 'string') {
        return { valid: false, error: 'Output must have a "type" field' };
    }

    switch (obj.type) {
        case 'ask_client':
            if (typeof obj.question_text !== 'string' || !obj.question_text) {
                return { valid: false, error: 'ask_client requires question_text string' };
            }
            if (typeof obj.why !== 'string') {
                return { valid: false, error: 'ask_client requires why string' };
            }
            return { valid: true, action: obj as unknown as MoltbotActionAskClient };

        case 'vendor_outreach_plan':
            if (typeof obj.category !== 'string' || !obj.category) {
                return { valid: false, error: 'vendor_outreach_plan requires category' };
            }
            if (typeof obj.normalized_need !== 'string') {
                return { valid: false, error: 'vendor_outreach_plan requires normalized_need' };
            }
            if (typeof obj.batch_size !== 'number' || obj.batch_size < 1 || obj.batch_size > 5) {
                return { valid: false, error: 'vendor_outreach_plan batch_size must be 1-5' };
            }
            if (!obj.stop_conditions || typeof obj.stop_conditions !== 'object') {
                return { valid: false, error: 'vendor_outreach_plan requires stop_conditions' };
            }
            const stopCond = obj.stop_conditions as Record<string, unknown>;
            if (typeof stopCond.max_vendors !== 'number' || stopCond.max_vendors > 15) {
                return { valid: false, error: 'stop_conditions.max_vendors must be <= 15' };
            }
            return { valid: true, action: obj as unknown as MoltbotActionVendorOutreachPlan };

        case 'shortlist':
            if (typeof obj.summary_text !== 'string') {
                return { valid: false, error: 'shortlist requires summary_text' };
            }
            if (!Array.isArray(obj.items)) {
                return { valid: false, error: 'shortlist requires items array' };
            }
            if (!obj.handoff || typeof obj.handoff !== 'object') {
                return { valid: false, error: 'shortlist requires handoff object' };
            }
            return { valid: true, action: obj as unknown as MoltbotActionShortlist };

        case 'escalate':
            if (typeof obj.reason !== 'string' || !obj.reason) {
                return { valid: false, error: 'escalate requires reason' };
            }
            if (typeof obj.safe_client_message !== 'string') {
                return { valid: false, error: 'escalate requires safe_client_message' };
            }
            return { valid: true, action: obj as unknown as MoltbotActionEscalate };

        default:
            return { valid: false, error: `Unknown action type: ${obj.type}` };
    }
}

// =============================================================================
// State Transition Helpers
// =============================================================================

/**
 * Valid state transitions for the request state machine.
 * Use this to validate transitions before updating.
 */
export const MOLTBOT_STATE_TRANSITIONS: Record<MoltbotRequestState, MoltbotRequestState[]> = {
    collecting_requirements: ['ocr_processing', 'vendor_outreach', 'error', 'closed'],
    ocr_processing: ['collecting_requirements', 'vendor_outreach', 'error'],
    vendor_outreach: ['awaiting_vendor_replies', 'error'],
    awaiting_vendor_replies: ['shortlist_ready', 'vendor_outreach', 'error'],
    shortlist_ready: ['handed_off', 'closed', 'error'],
    handed_off: ['closed'],
    closed: [],
    error: ['collecting_requirements', 'closed'],
};

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(
    from: MoltbotRequestState,
    to: MoltbotRequestState
): boolean {
    return MOLTBOT_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}
