/**
 * OCR Media Handler
 * 
 * Detects image/document messages and creates OCR jobs in moltbot_ocr_jobs table.
 * Implements Workflow 04 integration with WhatsApp webhook.
 */

import { logError, logInfo } from "../../_shared/correlation-logging.ts";
import { supabase } from "../../_shared/wa-webhook-shared/config.ts";
import type {
    WhatsAppDocumentMessage,
    WhatsAppImageMessage,
    WhatsAppMessage,
    WhatsAppWebhookPayload,
} from "../../_shared/wa-webhook-shared/types.ts";
import { getFirstMessage } from "../utils/message-extraction.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: { env?: { get(key: string): string | undefined } } | undefined;

const getEnvValue = (key: string): string | undefined => {
    return typeof Deno !== "undefined" && Deno?.env?.get ? Deno.env.get(key) : undefined;
};

// Media type constants
const OCR_ELIGIBLE_TYPES = ["image", "document"] as const;
type OcrEligibleType = typeof OCR_ELIGIBLE_TYPES[number];

// OCR type determination keywords - pharmacy/medical triggers medical_prescription
const MEDICAL_KEYWORDS = [
    "pharmacy",
    "medicine",
    "medication",
    "prescription",
    "drug",
    "tablet",
    "pills",
    "dose",
    "rx",
];

/**
 * Check if a message type is eligible for OCR processing
 */
export function isOcrEligibleMessage(message: WhatsAppMessage | undefined): message is WhatsAppImageMessage | WhatsAppDocumentMessage {
    if (!message) return false;
    return OCR_ELIGIBLE_TYPES.includes(message.type as OcrEligibleType);
}

/**
 * Extract media ID from WhatsApp message
 */
export function getMediaId(message: WhatsAppImageMessage | WhatsAppDocumentMessage): string | null {
    if (message.type === "image") {
        return (message as WhatsAppImageMessage).image?.id ?? null;
    }
    if (message.type === "document") {
        return (message as WhatsAppDocumentMessage).document?.id ?? null;
    }
    return null;
}

/**
 * Get media URL from WhatsApp Media ID
 * Uses WhatsApp Business API to retrieve the download URL
 */
async function getMediaUrl(mediaId: string): Promise<string | null> {
    const accessToken = getEnvValue("WA_ACCESS_TOKEN") || getEnvValue("WHATSAPP_ACCESS_TOKEN");
    if (!accessToken) {
        logError("OCR_HANDLER_NO_ACCESS_TOKEN", { reason: "Missing WA_ACCESS_TOKEN" }, { correlationId: "" });
        return null;
    }

    try {
        // Call WhatsApp API to get media URL
        const response = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            logError("OCR_HANDLER_MEDIA_FETCH_FAILED", {
                status: response.status,
                mediaId: mediaId.substring(0, 10) + "..."
            }, { correlationId: "" });
            return null;
        }

        const data = await response.json();
        return data.url ?? null;
    } catch (error) {
        logError("OCR_HANDLER_MEDIA_FETCH_ERROR", {
            error: error instanceof Error ? error.message : String(error),
        }, { correlationId: "" });
        return null;
    }
}

/**
 * Determine OCR type based on context
 */
async function determineOcrType(
    from: string,
    conversationId: string | null,
): Promise<"medical_prescription" | "general_document_or_photo"> {
    // Check if there's an active marketplace request with pharmacy/medicine context
    if (conversationId) {
        try {
            const { data: request } = await supabase
                .from("moltbot_marketplace_requests")
                .select("requirements")
                .eq("conversation_id", conversationId)
                .eq("state", "ocr_processing")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (request?.requirements) {
                const requirements = request.requirements as Record<string, unknown>;
                const category = (requirements.category as string || "").toLowerCase();
                const text = (requirements.original_text as string || "").toLowerCase();

                // Check if category or text suggests medical context
                if (MEDICAL_KEYWORDS.some(kw => category.includes(kw) || text.includes(kw))) {
                    return "medical_prescription";
                }
            }
        } catch (error) {
            logError("OCR_HANDLER_TYPE_DETECTION_ERROR", {
                error: error instanceof Error ? error.message : String(error),
            }, { correlationId: conversationId ?? "" });
        }
    }

    // Default to general document/photo
    return "general_document_or_photo";
}

/**
 * Find or create marketplace request for media message
 */
async function findOrCreateRequest(
    from: string,
    conversationId: string | null,
): Promise<string | null> {
    // First, look for an existing request in ocr_processing state
    if (conversationId) {
        const { data: existingRequest } = await supabase
            .from("moltbot_marketplace_requests")
            .select("id")
            .eq("conversation_id", conversationId)
            .in("state", ["ocr_processing", "client_conversation"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingRequest?.id) {
            return existingRequest.id;
        }
    }

    // Create a new request for this media message
    const { data: newRequest, error } = await supabase
        .from("moltbot_marketplace_requests")
        .insert({
            conversation_id: conversationId,
            state: "ocr_processing",
            requirements: {
                source: "media_message",
                from_number: from,
                created_at: new Date().toISOString(),
            },
        })
        .select("id")
        .single();

    if (error) {
        logError("OCR_HANDLER_CREATE_REQUEST_ERROR", {
            error: error.message,
        }, { correlationId: from });
        return null;
    }

    return newRequest?.id ?? null;
}

/**
 * Create an OCR job for a media message
 */
export async function createOcrJob(
    message: WhatsAppImageMessage | WhatsAppDocumentMessage,
    conversationId: string | null,
    correlationId: string,
): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const mediaId = getMediaId(message);
    if (!mediaId) {
        return { success: false, error: "No media ID found" };
    }

    const from = message.from;

    // Find or create marketplace request
    const requestId = await findOrCreateRequest(from, conversationId);
    if (!requestId) {
        return { success: false, error: "Could not create marketplace request" };
    }

    // Get media URL from WhatsApp
    const mediaUrl = await getMediaUrl(mediaId);
    if (!mediaUrl) {
        return { success: false, error: "Could not retrieve media URL" };
    }

    // Determine OCR type
    const ocrType = await determineOcrType(from, conversationId);

    // Check for existing job with same message ID (idempotency)
    const { data: existingJob } = await supabase
        .from("moltbot_ocr_jobs")
        .select("id")
        .eq("message_id", message.id)
        .maybeSingle();

    if (existingJob) {
        logInfo("OCR_JOB_ALREADY_EXISTS", {
            messageId: message.id,
            jobId: existingJob.id,
        }, { correlationId });
        return { success: true, jobId: existingJob.id };
    }

    // Create OCR job
    const { data: job, error } = await supabase
        .from("moltbot_ocr_jobs")
        .insert({
            request_id: requestId,
            message_id: message.id,
            status: "pending",
            provider: "gemini",
            media_url: mediaUrl,
            media_type: message.type,
            extracted: {
                ocr_type: ocrType,
                from_number: from,
            },
        })
        .select("id")
        .single();

    if (error) {
        logError("OCR_JOB_CREATE_ERROR", {
            error: error.message,
            messageId: message.id,
        }, { correlationId });
        return { success: false, error: error.message };
    }

    logInfo("OCR_JOB_CREATED", {
        jobId: job.id,
        requestId,
        ocrType,
        mediaType: message.type,
    }, { correlationId });

    return { success: true, jobId: job.id };
}

/**
 * Handle incoming media message - detect and create OCR job if eligible
 * 
 * Returns true if the message was handled as media (OCR job created or attempted),
 * false if not a media message
 */
export async function handleMediaMessage(
    payload: WhatsAppWebhookPayload,
    correlationId: string,
): Promise<{ handled: boolean; jobId?: string; error?: string }> {
    const message = getFirstMessage(payload);

    if (!isOcrEligibleMessage(message)) {
        return { handled: false };
    }

    logInfo("OCR_MEDIA_MESSAGE_DETECTED", {
        type: message.type,
        from: message.from?.substring(0, 6) + "***",
    }, { correlationId });

    // Extract conversation ID from session or create one
    // For now, use a generated conversation ID based on the phone number
    const conversationId = `wa_${message.from}_${Date.now()}`;

    const result = await createOcrJob(
        message as WhatsAppImageMessage | WhatsAppDocumentMessage,
        conversationId,
        correlationId,
    );

    return {
        handled: true,
        jobId: result.jobId,
        error: result.error,
    };
}

/**
 * Send acknowledgment message to user that image is being processed
 */
export async function sendOcrAcknowledgment(
    to: string,
    language: "en" | "fr" | "rw" = "en",
): Promise<void> {
    const { sendText } = await import("../../_shared/wa-webhook-shared/wa/client.ts");

    const messages: Record<string, string> = {
        en: "📷 Got your image! Analyzing now... I'll follow up shortly.",
        fr: "📷 Image reçue ! Analyse en cours... Je reviens vers vous bientôt.",
        rw: "📷 Nabonye ifoto yawe! Ndareba... Nzagusubiza vuba.",
    };

    try {
        await sendText(to, messages[language] || messages.en);
    } catch (error) {
        logError("OCR_ACK_SEND_FAILED", {
            error: error instanceof Error ? error.message : String(error),
        }, { correlationId: to });
    }
}
