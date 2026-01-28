/**
 * Moltbot Marketplace Concierge Handler
 *
 * Handles marketplace requests using AI or coded workflows.
 *
 * @module wa-webhook-core/handlers/moltbot
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { MoltbotOrchestrator, type MoltbotContextPack, type OrchestratorResult } from "../../_shared/moltbot/orchestrator.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface MoltbotHandlerResult {
    handled: boolean;
    result?: OrchestratorResult;
    error?: string;
}

/**
 * Handle a potential marketplace request via Moltbot
 *
 * @param payload WhatsApp webhook payload
 * @param clientPhone Client's phone number
 * @param correlationId Request correlation ID
 * @param supabase Supabase client
 */
export async function handleMoltbotRequest(
    payload: unknown,
    clientPhone: string,
    correlationId: string,
    supabase: SupabaseClient,
): Promise<MoltbotHandlerResult> {
    const log = (event: string, details: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") => {
        logStructuredEvent(event, {
            service: "wa-webhook-core",
            correlationId,
            ...details,
        }, level);
    };

    try {
        // Check if marketplace concierge is active for this conversation
        // First, check if there's an active marketplace request for this phone
        const { data: conversation, error: convError } = await supabase
            .from("moltbot_conversations")
            .select("id, active_request_id, language")
            .eq("client_phone", clientPhone)
            .single();

        // If no conversation, this isn't a marketplace request
        if (!conversation) {
            return { handled: false };
        }

        // If no active request, check if the message is a new marketplace trigger
        if (!conversation.active_request_id) {
            // TODO: Implement trigger detection (e.g., "I need..." or menu command)
            // For now, only handle if there's an active request
            return { handled: false };
        }

        log("MOLTBOT_REQUEST_DETECTED", {
            conversationId: conversation.id,
            requestId: conversation.active_request_id,
        });

        // Get the active request
        const { data: request, error: reqError } = await supabase
            .from("moltbot_marketplace_requests")
            .select("id, conversation_id, state, requirements, shortlist, error_reason")
            .eq("id", conversation.active_request_id)
            .single();

        if (!request || reqError) {
            log("MOLTBOT_REQUEST_NOT_FOUND", {
                error: reqError?.message,
            }, "warn");
            return { handled: false };
        }

        // Extract message text from payload
        const messageText = extractMessageText(payload);
        if (!messageText) {
            log("MOLTBOT_NO_MESSAGE_TEXT", {});
            return { handled: false };
        }

        // Get recent messages for context
        const { data: recentMsgs } = await supabase
            .from("moltbot_conversation_messages")
            .select("direction, body, timestamp")
            .eq("conversation_id", conversation.id)
            .order("timestamp", { ascending: false })
            .limit(10);

        // Build context pack for orchestrator
        const contextPack: MoltbotContextPack = {
            conversation: {
                id: conversation.id,
                clientPhone,
                language: conversation.language ?? "en",
                recentMessages: (recentMsgs ?? []).reverse().map((m) => ({
                    role: m.direction === "inbound" ? "client" as const : "bot" as const,
                    text: m.body ?? "",
                    timestamp: m.timestamp,
                })),
            },
            request: {
                id: request.id,
                conversation_id: request.conversation_id,
                state: request.state,
                requirements: request.requirements ?? {},
                shortlist: request.shortlist ?? [],
                error_reason: request.error_reason,
            },
        };

        // Add current message to context
        contextPack.conversation.recentMessages.push({
            role: "client",
            text: messageText,
            timestamp: new Date().toISOString(),
        });

        // Initialize orchestrator
        const orchestrator = new MoltbotOrchestrator(supabase);

        // Process request
        const result = await orchestrator.processRequest(contextPack);

        log("MOLTBOT_REQUEST_PROCESSED", {
            conversationId: conversation.id,
            requestId: request.id,
            success: result.success,
            mode: result.mode,
            actionType: result.action?.type,
            nextState: result.nextState,
        });

        return {
            handled: true,
            result,
        };
    } catch (error) {
        log("MOLTBOT_HANDLER_ERROR", {
            error: error instanceof Error ? error.message : String(error),
        }, "error");

        return {
            handled: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Extract message text from WhatsApp webhook payload
 */
function extractMessageText(payload: unknown): string | null {
    const entry = (payload as Record<string, unknown>)?.entry;
    if (!Array.isArray(entry) || !entry[0]) return null;

    const changes = entry[0]?.changes;
    if (!Array.isArray(changes) || !changes[0]) return null;

    const message = changes[0]?.value?.messages?.[0];
    if (!message) return null;

    // Text message
    if (message.type === "text") {
        return message.text?.body ?? null;
    }

    // Interactive message (button reply or list selection)
    if (message.type === "interactive") {
        return message.interactive?.button_reply?.title ??
            message.interactive?.list_reply?.title ??
            null;
    }

    return null;
}

/**
 * Check if message could be a marketplace trigger
 * (not yet used, for future trigger detection)
 */
export function isMarketplaceTrigger(messageText: string): boolean {
    const triggers = [
        /^(i need|looking for|where can i find|help me find)/i,
        /^(ninshaka|ndashaka|mfasha kubona)/i, // Kinyarwanda
        /^(!market|!find|!shop)/i,
    ];

    return triggers.some((pattern) => pattern.test(messageText.trim()));
}
