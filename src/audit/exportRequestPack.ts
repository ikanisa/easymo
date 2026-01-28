/**
 * Reconciliation Pack Generator
 *
 * Exports a complete audit bundle for a given request_id.
 * Used for compliance, debugging, and "explain this decision" queries.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "./logger";
import { createHash } from "crypto";

const log = createLogger({ service: "reconciliation-pack" });

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
    if (cachedClient) return cachedClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    cachedClient = createClient(url, key, { auth: { persistSession: false } });
    return cachedClient;
}

// ============================================================================
// Types
// ============================================================================

export interface RequestSnapshot {
    id: string;
    conversation_id: string;
    state: string;
    requirements: Record<string, unknown>;
    shortlist: unknown[];
    error_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface ConversationMessage {
    id: string;
    direction: string;
    message_type: string;
    body_redacted: string | null;
    timestamp: string;
}

export interface OcrJobSummary {
    id: string;
    status: string;
    provider: string;
    media_type: string | null;
    confidence: number | null;
    extracted_summary: string | null;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
}

export interface VendorOutreachSummary {
    id: string;
    vendor_id_hash: string;
    state: string;
    outreach_sent_at: string | null;
    response_received_at: string | null;
    has_response: boolean;
}

export interface AuditEventSummary {
    id: string;
    event_type: string;
    actor: string;
    tool_name: string | null;
    input_hash: string | null;
    output_hash: string | null;
    success: boolean;
    duration_ms: number | null;
    created_at: string;
}

export interface CallAttemptSummary {
    id: string;
    status: string;
    duration_seconds: number | null;
    initiated_at: string;
    ended_at: string | null;
}

export interface ReconciliationPack {
    request_id: string;
    generated_at: string;
    request: RequestSnapshot | null;
    conversation: {
        id: string;
        client_phone_masked: string;
        language: string;
        message_count: number;
        messages: ConversationMessage[];
    } | null;
    ocr_jobs: OcrJobSummary[];
    vendor_outreach: VendorOutreachSummary[];
    audit_events: AuditEventSummary[];
    call_attempts: CallAttemptSummary[];
    summary: {
        total_messages: number;
        total_ocr_jobs: number;
        total_vendors_contacted: number;
        total_vendors_replied: number;
        total_moltbot_calls: number;
        total_call_attempts: number;
        time_to_complete_ms: number | null;
        final_state: string | null;
    };
}

// ============================================================================
// Redaction Helpers
// ============================================================================

/**
 * Mask phone number (show only last 3 digits)
 */
function maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return "***";
    return "***" + phone.slice(-3);
}

/**
 * Hash a vendor ID for external exports
 */
function hashVendorId(vendorId: string): string {
    return createHash("sha256").update(vendorId).digest("hex").slice(0, 12);
}

/**
 * Redact message body (truncate and remove PII patterns)
 */
function redactMessageBody(body: string | null): string | null {
    if (!body) return null;
    // Truncate to 100 chars
    let redacted = body.length > 100 ? body.slice(0, 100) + "..." : body;
    // Mask phone number patterns
    redacted = redacted.replace(/\+?\d{10,15}/g, "[PHONE]");
    // Mask email patterns
    redacted = redacted.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]");
    return redacted;
}

/**
 * Summarize extracted OCR data (without full text)
 */
function summarizeExtracted(extracted: Record<string, unknown> | null): string | null {
    if (!extracted || Object.keys(extracted).length === 0) return null;
    const keys = Object.keys(extracted);
    return `${keys.length} fields: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}`;
}

// ============================================================================
// Export Function
// ============================================================================

/**
 * Generate a complete reconciliation pack for a request
 */
export async function exportRequestPack(requestId: string): Promise<ReconciliationPack | null> {
    const client = getClient();
    if (!client) {
        log.error({ msg: "reconciliation_pack_failed", reason: "supabase_not_configured", requestId });
        return null;
    }

    const startTime = Date.now();

    // Fetch request
    const { data: request, error: requestError } = await client
        .from("moltbot_marketplace_requests")
        .select("*")
        .eq("id", requestId)
        .single();

    if (requestError || !request) {
        log.error({ msg: "reconciliation_pack_failed", reason: "request_not_found", requestId });
        return null;
    }

    // Fetch conversation
    const { data: conversation } = await client
        .from("moltbot_conversations")
        .select("*")
        .eq("id", request.conversation_id)
        .single();

    // Fetch messages
    const { data: messages } = await client
        .from("moltbot_conversation_messages")
        .select("id, direction, message_type, body, timestamp")
        .eq("conversation_id", request.conversation_id)
        .order("timestamp", { ascending: true });

    // Fetch OCR jobs
    const { data: ocrJobs } = await client
        .from("moltbot_ocr_jobs")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

    // Fetch vendor outreach
    const { data: vendorOutreach } = await client
        .from("moltbot_vendor_outreach")
        .select("id, vendor_id, state, outreach_sent_at, response_received_at, response_message")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

    // Fetch audit events
    const { data: auditEvents } = await client
        .from("moltbot_audit_events")
        .select("id, event_type, actor, tool_name, input_hash, output_hash, success, duration_ms, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

    // Fetch call attempts (via consent)
    const { data: callConsents } = await client
        .from("moltbot_call_consents")
        .select("id")
        .eq("conversation_id", request.conversation_id);

    let callAttempts: CallAttemptSummary[] = [];
    if (callConsents && callConsents.length > 0) {
        const consentIds = callConsents.map((c) => c.id);
        const { data: attempts } = await client
            .from("moltbot_call_attempts")
            .select("id, status, duration_seconds, initiated_at, ended_at")
            .in("consent_id", consentIds)
            .order("initiated_at", { ascending: true });

        callAttempts = (attempts ?? []).map((a) => ({
            id: a.id,
            status: a.status,
            duration_seconds: a.duration_seconds,
            initiated_at: a.initiated_at,
            ended_at: a.ended_at,
        }));
    }

    // Build pack
    const pack: ReconciliationPack = {
        request_id: requestId,
        generated_at: new Date().toISOString(),

        request: {
            id: request.id,
            conversation_id: request.conversation_id,
            state: request.state,
            requirements: request.requirements ?? {},
            shortlist: request.shortlist ?? [],
            error_reason: request.error_reason,
            created_at: request.created_at,
            updated_at: request.updated_at,
        },

        conversation: conversation
            ? {
                id: conversation.id,
                client_phone_masked: maskPhone(conversation.client_phone),
                language: conversation.language,
                message_count: messages?.length ?? 0,
                messages: (messages ?? []).map((m) => ({
                    id: m.id,
                    direction: m.direction,
                    message_type: m.message_type,
                    body_redacted: redactMessageBody(m.body),
                    timestamp: m.timestamp,
                })),
            }
            : null,

        ocr_jobs: (ocrJobs ?? []).map((j) => ({
            id: j.id,
            status: j.status,
            provider: j.provider,
            media_type: j.media_type,
            confidence: j.confidence,
            extracted_summary: summarizeExtracted(j.extracted),
            error_message: j.error_message,
            created_at: j.created_at,
            completed_at: j.completed_at,
        })),

        vendor_outreach: (vendorOutreach ?? []).map((v) => ({
            id: v.id,
            vendor_id_hash: hashVendorId(v.vendor_id),
            state: v.state,
            outreach_sent_at: v.outreach_sent_at,
            response_received_at: v.response_received_at,
            has_response: !!v.response_message,
        })),

        audit_events: (auditEvents ?? []).map((e) => ({
            id: e.id,
            event_type: e.event_type,
            actor: e.actor,
            tool_name: e.tool_name,
            input_hash: e.input_hash,
            output_hash: e.output_hash,
            success: e.success ?? true,
            duration_ms: e.duration_ms,
            created_at: e.created_at,
        })),

        call_attempts: callAttempts,

        summary: {
            total_messages: messages?.length ?? 0,
            total_ocr_jobs: ocrJobs?.length ?? 0,
            total_vendors_contacted: vendorOutreach?.length ?? 0,
            total_vendors_replied: vendorOutreach?.filter((v) => v.response_message).length ?? 0,
            total_moltbot_calls: auditEvents?.filter((e) => e.event_type === "moltbot.called").length ?? 0,
            total_call_attempts: callAttempts.length,
            time_to_complete_ms:
                request.state === "handed_off" || request.state === "closed"
                    ? new Date(request.updated_at).getTime() - new Date(request.created_at).getTime()
                    : null,
            final_state: request.state,
        },
    };

    log.info({
        msg: "reconciliation_pack_generated",
        request_id: requestId,
        generation_ms: Date.now() - startTime,
        summary: pack.summary,
    });

    return pack;
}
