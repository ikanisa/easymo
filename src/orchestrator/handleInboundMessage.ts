/**
 * Moltbot Orchestrator — Handle Inbound Message
 *
 * Main entry point for processing inbound WhatsApp messages.
 * Follows the pattern: Load Context → Call Moltbot → Validate → Execute Tools → Audit.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    MoltbotContextPack,
    MoltbotOutputAction,
    MoltbotRequestState,
    validateMoltbotOutput,
    isValidStateTransition,
} from '@easymo/types';
import { buildMoltbotContextPack, ingestMoltbotMessage } from '@easymo/db';
import { executeToolAction } from './tools';
import { logAuditEvent } from './audit';
import { checkFeatureFlag } from './flags';
import { sendTextMessage } from '../whatsapp';

// =============================================================================
// Types
// =============================================================================

export interface InboundMessageEvent {
    provider_message_id: string;
    conversation_id: string;
    request_id?: string;
    direction: 'inbound';
    message_type: 'text' | 'image' | 'document' | 'audio' | 'video';
    body?: string;
    media_url?: string;
    media_mime_type?: string;
    timestamp: string;
}

export interface HandleInboundResult {
    success: boolean;
    action_taken?: MoltbotOutputAction['type'];
    error?: string;
    fallback_used?: boolean;
}

// =============================================================================
// Fallback Message (coded workflow)
// =============================================================================

const FALLBACK_MESSAGE =
    "Merci pour votre message. Un agent va vous répondre bientôt. / Thank you for your message. An agent will respond shortly.";

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle an inbound WhatsApp message.
 * This is the single orchestrator loop for Moltbot.
 */
export async function handleInboundMessage(
    supabase: SupabaseClient,
    event: InboundMessageEvent,
    options?: {
        callMoltbot?: (context: MoltbotContextPack) => Promise<unknown>;
        dryRun?: boolean;
    }
): Promise<HandleInboundResult> {
    const startTime = Date.now();

    try {
        // =========================================================================
        // Step 1: Check AI feature flag
        // =========================================================================
        const aiEnabled = await checkFeatureFlag(supabase, 'AI_CONCIERGE_ENABLED');
        if (!aiEnabled) {
            // AI disabled — use coded fallback
            await sendFallbackMessage(supabase, event.conversation_id);
            return { success: true, fallback_used: true };
        }

        // =========================================================================
        // Step 2: Idempotent message ingestion
        // =========================================================================
        const ingestResult = await ingestMoltbotMessage(supabase, {
            conversation_id: event.conversation_id,
            provider_message_id: event.provider_message_id,
            direction: event.direction,
            message_type: event.message_type,
            body: event.body ?? null,
            media_url: event.media_url,
            media_mime_type: event.media_mime_type,
            timestamp: event.timestamp,
            source: 'whatsapp',
        });

        if (!ingestResult.success) {
            // Already processed (duplicate)
            return { success: true, action_taken: undefined };
        }

        // =========================================================================
        // Step 3: Get or create request
        // =========================================================================
        let requestId = event.request_id;
        if (!requestId) {
            requestId = await getOrCreateRequest(supabase, event.conversation_id);
        }

        // =========================================================================
        // Step 4: Handle media → OCR routing
        // =========================================================================
        if (isMediaMessage(event)) {
            const ocrEnabled = await checkFeatureFlag(supabase, 'OCR_ENABLED');
            if (ocrEnabled && event.media_url) {
                await createOcrJob(supabase, requestId, ingestResult.message_id!, event.media_url, event.media_mime_type);
                await updateRequestState(supabase, requestId, 'ocr_processing');
                await sendClientMessage(supabase, event.conversation_id, "Processing your image... / Traitement de votre image...");
                return { success: true, action_taken: 'ask_client' };
            }
        }

        // =========================================================================
        // Step 5: Build context pack
        // =========================================================================
        const context = await buildMoltbotContextPack(supabase, requestId);

        // =========================================================================
        // Step 6: Call Moltbot
        // =========================================================================
        const callMoltbot = options?.callMoltbot ?? defaultMoltbotCaller;
        const rawOutput = await callMoltbot(context);

        // =========================================================================
        // Step 7: Validate output against contract
        // =========================================================================
        const validation = validateMoltbotOutput(rawOutput);
        if (!validation.valid) {
            // Invalid output — fallback to coded workflow
            await logAuditEvent(supabase, {
                request_id: requestId,
                event_type: 'moltbot.output_rejected',
                details: { error: validation.error, raw: String(rawOutput).slice(0, 200) },
            });
            await sendFallbackMessage(supabase, event.conversation_id);
            return { success: true, fallback_used: true, error: validation.error };
        }

        const action = validation.action;

        // =========================================================================
        // Step 8: Execute action via tools
        // =========================================================================
        if (!options?.dryRun) {
            await executeToolAction(supabase, requestId, event.conversation_id, action);
        }

        // =========================================================================
        // Step 9: Audit log
        // =========================================================================
        await logAuditEvent(supabase, {
            request_id: requestId,
            event_type: 'moltbot.action_executed',
            details: { action_type: action.type, duration_ms: Date.now() - startTime },
        });

        return { success: true, action_taken: action.type };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Log error but don't expose internals
        await logAuditEvent(supabase, {
            request_id: event.request_id,
            event_type: 'moltbot.error',
            details: { error: errorMessage },
        });

        // Send safe fallback
        await sendFallbackMessage(supabase, event.conversation_id);

        return { success: false, error: errorMessage, fallback_used: true };
    }
}

// =============================================================================
// Helper Functions (stubs — implement in tools/)
// =============================================================================

function isMediaMessage(event: InboundMessageEvent): boolean {
    return ['image', 'document', 'audio', 'video'].includes(event.message_type);
}

async function getOrCreateRequest(supabase: SupabaseClient, conversationId: string): Promise<string> {
    // Check for existing active request
    const { data: existing } = await supabase
        .from('moltbot_marketplace_requests')
        .select('id')
        .eq('conversation_id', conversationId)
        .neq('state', 'closed')
        .neq('state', 'handed_off')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (existing) {
        return existing.id;
    }

    // Create new request
    const { data: created, error } = await supabase
        .from('moltbot_marketplace_requests')
        .insert({ conversation_id: conversationId, state: 'collecting_requirements' })
        .select('id')
        .single();

    if (error) throw error;
    return created.id;
}

async function createOcrJob(
    supabase: SupabaseClient,
    requestId: string,
    messageId: string,
    mediaUrl: string,
    mediaType?: string
): Promise<void> {
    await supabase.from('moltbot_ocr_jobs').insert({
        request_id: requestId,
        message_id: messageId,
        media_url: mediaUrl,
        media_type: mediaType,
        status: 'pending',
        provider: 'gemini',
    });
}

async function updateRequestState(
    supabase: SupabaseClient,
    requestId: string,
    newState: MoltbotRequestState
): Promise<void> {
    // Get current state for validation
    const { data: current } = await supabase
        .from('moltbot_marketplace_requests')
        .select('state')
        .eq('id', requestId)
        .single();

    if (current && !isValidStateTransition(current.state, newState)) {
        throw new Error(`Invalid state transition: ${current.state} → ${newState}`);
    }

    await supabase
        .from('moltbot_marketplace_requests')
        .update({ state: newState })
        .eq('id', requestId);
}

async function sendClientMessage(
    supabase: SupabaseClient,
    conversationId: string,
    message: string,
    requestId?: string
): Promise<void> {
    // Get conversation details for sending
    const { data: conversation } = await supabase
        .from('moltbot_conversations')
        .select('client_phone')
        .eq('id', conversationId)
        .single();

    if (!conversation?.client_phone) {
        console.warn(`[sendClientMessage] No phone for conversation ${conversationId}`);
        return;
    }

    await sendTextMessage(
        supabase,
        conversationId,
        requestId || 'fallback',
        conversation.client_phone,
        message
    );
}

async function sendFallbackMessage(
    supabase: SupabaseClient,
    conversationId: string
): Promise<void> {
    await sendClientMessage(supabase, conversationId, FALLBACK_MESSAGE);
}

async function defaultMoltbotCaller(_context: MoltbotContextPack): Promise<unknown> {
    // Default stub — returns escalate for now
    return {
        type: 'escalate',
        reason: 'Moltbot caller not configured',
        safe_client_message: FALLBACK_MESSAGE,
    };
}
