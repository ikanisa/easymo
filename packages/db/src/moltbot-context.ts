/**
 * Moltbot Context Pack Builder
 * 
 * Builds the minimal, clean context pack that Moltbot receives
 * for decision-making from database state.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    MoltbotContextPack,
    MoltbotConversationMessage,
    MoltbotOcrResult,
    MoltbotPolicyFlags,
    MoltbotVendorOutreachSummary,
} from '@easymo/types';


// Default policy flags (can be overridden per-tenant)
const DEFAULT_POLICIES: MoltbotPolicyFlags = {
    calling_enabled: false,
    ocr_enabled: true,
    ai_enabled: true,
    max_vendors_per_request: 10,
    vendor_reply_timeout_hours: 24,
};

/**
 * Build a context pack for Moltbot from database state.
 * 
 * @param supabase - Supabase client with service_role access
 * @param requestId - The marketplace request ID
 * @param options - Optional configuration
 * @returns The context pack, or null if request not found
 */
export async function buildMoltbotContextPack(
    supabase: SupabaseClient,
    requestId: string,
    options: {
        maxMessages?: number;
        policies?: Partial<MoltbotPolicyFlags>;
    } = {}
): Promise<MoltbotContextPack | null> {
    const { maxMessages = 20, policies: policyOverrides } = options;

    // 1. Fetch the marketplace request
    const { data: request, error: requestError } = await supabase
        .from('moltbot_marketplace_requests')
        .select('*')
        .eq('id', requestId)
        .single();

    if (requestError || !request) {
        console.error('[moltbot-context] Request not found:', requestId, requestError);
        return null;
    }

    // 2. Fetch the conversation
    const { data: conversation, error: convError } = await supabase
        .from('moltbot_conversations')
        .select('id, language')
        .eq('id', request.conversation_id)
        .single();

    if (convError || !conversation) {
        console.error('[moltbot-context] Conversation not found:', request.conversation_id, convError);
        return null;
    }

    // 3. Fetch last N messages
    const { data: messages } = await supabase
        .from('moltbot_conversation_messages')
        .select('direction, body, timestamp, message_type')
        .eq('conversation_id', request.conversation_id)
        .order('timestamp', { ascending: false })
        .limit(maxMessages);

    const lastMessages: Pick<MoltbotConversationMessage, 'direction' | 'body' | 'timestamp' | 'message_type'>[] =
        (messages ?? []).reverse(); // Chronological order

    // 4. Fetch latest OCR job (if any)
    const { data: ocrJob } = await supabase
        .from('moltbot_ocr_jobs')
        .select('id, status, extracted, confidence')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    const ocr: MoltbotOcrResult | undefined = ocrJob
        ? {
            job_id: ocrJob.id,
            status: ocrJob.status,
            extracted: ocrJob.extracted ?? {},
            confidence: ocrJob.confidence,
        }
        : undefined;

    // 5. Build vendor outreach summary
    const { data: outreachStats } = await supabase
        .from('moltbot_vendor_outreach')
        .select('state')
        .eq('request_id', requestId);

    const vendorOutreachSummary: MoltbotVendorOutreachSummary = {
        total_vendors: outreachStats?.length ?? 0,
        queued: outreachStats?.filter((o) => o.state === 'queued').length ?? 0,
        sent: outreachStats?.filter((o) => o.state === 'sent').length ?? 0,
        replied: outreachStats?.filter((o) => o.state === 'replied').length ?? 0,
        no_response: outreachStats?.filter((o) => o.state === 'no_response').length ?? 0,
        failed: outreachStats?.filter((o) => o.state === 'failed').length ?? 0,
        excluded: outreachStats?.filter((o) => o.state === 'excluded').length ?? 0,
    };

    // 6. Merge policies
    const policies: MoltbotPolicyFlags = {
        ...DEFAULT_POLICIES,
        ...policyOverrides,
    };

    // 7. Assemble context pack
    const contextPack: MoltbotContextPack = {
        request_id: requestId,
        conversation_id: conversation.id,
        language: conversation.language,
        request_state: request.state,
        requirements: request.requirements ?? {},
        last_messages: lastMessages,
        ocr,
        vendor_outreach_summary: vendorOutreachSummary,
        policies,
        style_constraints: {
            max_questions_per_turn: 3,
            concise: true,
        },
    };

    return contextPack;
}

/**
 * Ingest a WhatsApp message idempotently.
 * Returns the message row (existing or newly created).
 */
export async function ingestMoltbotMessage(
    supabase: SupabaseClient,
    message: {
        conversation_id: string;
        provider_message_id: string;
        direction: 'inbound' | 'outbound';
        message_type?: string;
        body?: string;
        media_url?: string;
        media_mime_type?: string;
        metadata?: Record<string, unknown>;
        timestamp: string;
    }
): Promise<{ id: string; is_new: boolean } | null> {
    // Try insert; unique constraint on provider_message_id handles dedupe
    const { data: inserted, error: insertError } = await supabase
        .from('moltbot_conversation_messages')
        .insert({
            conversation_id: message.conversation_id,
            provider_message_id: message.provider_message_id,
            direction: message.direction,
            message_type: message.message_type ?? 'text',
            body: message.body,
            media_url: message.media_url,
            media_mime_type: message.media_mime_type,
            metadata: message.metadata ?? {},
            timestamp: message.timestamp,
        })
        .select('id')
        .single();

    if (inserted) {
        return { id: inserted.id, is_new: true };
    }

    // If insert failed due to duplicate, fetch the existing row
    if (insertError?.code === '23505') {
        // unique_violation
        const { data: existing } = await supabase
            .from('moltbot_conversation_messages')
            .select('id')
            .eq('provider_message_id', message.provider_message_id)
            .single();

        if (existing) {
            return { id: existing.id, is_new: false };
        }
    }

    console.error('[moltbot-context] Failed to ingest message:', insertError);
    return null;
}

/**
 * Queue vendor outreach idempotently.
 * Returns the outreach row (existing or newly created).
 */
export async function queueMoltbotVendorOutreach(
    supabase: SupabaseClient,
    outreach: {
        request_id: string;
        vendor_id: string;
        outreach_message?: string;
    }
): Promise<{ id: string; is_new: boolean } | null> {
    // Try insert; unique constraint on (request_id, vendor_id) handles dedupe
    const { data: inserted, error: insertError } = await supabase
        .from('moltbot_vendor_outreach')
        .insert({
            request_id: outreach.request_id,
            vendor_id: outreach.vendor_id,
            outreach_message: outreach.outreach_message,
            state: 'queued',
        })
        .select('id')
        .single();

    if (inserted) {
        return { id: inserted.id, is_new: true };
    }

    // If insert failed due to duplicate, fetch the existing row
    if (insertError?.code === '23505') {
        const { data: existing } = await supabase
            .from('moltbot_vendor_outreach')
            .select('id')
            .eq('request_id', outreach.request_id)
            .eq('vendor_id', outreach.vendor_id)
            .single();

        if (existing) {
            return { id: existing.id, is_new: false };
        }
    }

    console.error('[moltbot-context] Failed to queue vendor outreach:', insertError);
    return null;
}
