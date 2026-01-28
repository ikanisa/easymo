/**
 * OCR Job Completion Handler
 *
 * Processes completed OCR jobs and triggers Moltbot orchestrator
 * with extracted data in the context pack.
 *
 * @module moltbot/ocr-completion
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { MoltbotOrchestrator, type MoltbotContextPack, type OrchestratorResult } from "./orchestrator.ts";

// Types
export interface OcrJob {
    id: string;
    request_id: string;
    message_id: string;
    status: string;
    provider: string | null;
    media_url: string;
    media_type: string;
    extracted: Record<string, unknown> | null;
    confidence: number | null;
    error_message: string | null;
}

export interface OcrCompletionResult {
    success: boolean;
    requestId?: string;
    nextState?: string;
    error?: string;
}

// Confidence threshold for auto-proceeding
const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Handle OCR job completion and trigger orchestrator
 */
export async function handleOcrCompletion(
    job: OcrJob,
    supabase: SupabaseClient,
): Promise<OcrCompletionResult> {
    try {
        // Get the marketplace request
        const { data: request, error: reqError } = await supabase
            .from("moltbot_marketplace_requests")
            .select("id, conversation_id, state, requirements, shortlist, error_reason")
            .eq("id", job.request_id)
            .single();

        if (!request || reqError) {
            return {
                success: false,
                error: `Request not found: ${reqError?.message}`,
            };
        }

        // Get conversation
        const { data: conversation } = await supabase
            .from("moltbot_conversations")
            .select("id, client_phone, language")
            .eq("id", request.conversation_id)
            .single();

        if (!conversation) {
            return {
                success: false,
                error: "Conversation not found",
            };
        }

        // Get recent messages
        const { data: recentMsgs } = await supabase
            .from("moltbot_conversation_messages")
            .select("direction, body, timestamp")
            .eq("conversation_id", conversation.id)
            .order("timestamp", { ascending: false })
            .limit(10);

        // Build context pack with OCR data
        const contextPack: MoltbotContextPack = {
            conversation: {
                id: conversation.id,
                clientPhone: conversation.client_phone,
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
                state: "ocr_processing", // Set state for coded workflow routing
                requirements: request.requirements ?? {},
                shortlist: request.shortlist ?? [],
                error_reason: request.error_reason,
            },
            ocrData: {
                extracted: job.extracted ?? {},
                confidence: job.confidence ?? 0,
            },
        };

        // Merge OCR extracted data into requirements
        await supabase
            .from("moltbot_marketplace_requests")
            .update({
                requirements: {
                    ...(request.requirements ?? {}),
                    ocr_extracted: job.extracted,
                    ocr_confidence: job.confidence,
                    ocr_completed: true,
                },
                updated_at: new Date().toISOString(),
            })
            .eq("id", request.id);

        // Run orchestrator
        const orchestrator = new MoltbotOrchestrator(supabase);
        const result = await orchestrator.processRequest(contextPack);

        return {
            success: result.success,
            requestId: request.id,
            nextState: result.nextState,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Process a pending OCR job using Gemini Vision
 */
export async function processOcrJob(
    job: OcrJob,
    supabase: SupabaseClient,
): Promise<{ success: boolean; extracted?: Record<string, unknown>; confidence?: number; error?: string }> {
    // Update job to processing
    await supabase
        .from("moltbot_ocr_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id);

    try {
        // Call Gemini Vision for OCR
        const ocrResult = await callGeminiVision(job.media_url, job.extracted?.ocr_type as string);

        // Update job with results
        await supabase
            .from("moltbot_ocr_jobs")
            .update({
                status: "completed",
                extracted: ocrResult.extracted,
                confidence: ocrResult.confidence,
                raw_response: ocrResult.rawResponse,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

        return {
            success: true,
            extracted: ocrResult.extracted,
            confidence: ocrResult.confidence,
        };
    } catch (error) {
        // Update job as failed
        const errorMessage = error instanceof Error ? error.message : String(error);

        await supabase
            .from("moltbot_ocr_jobs")
            .update({
                status: "failed",
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

        return { success: false, error: errorMessage };
    }
}

/**
 * Call Gemini Vision API for OCR
 */
async function callGeminiVision(
    mediaUrl: string,
    ocrType: string,
): Promise<{ extracted: Record<string, unknown>; confidence: number; rawResponse: string }> {
    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_AI_API_KEY");

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    // Build prompt based on OCR type
    const prompt = buildOcrPrompt(ocrType);

    // Fetch image and convert to base64
    const imageResponse = await fetch(mediaUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";

    // Call Gemini Vision API
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Image,
                            },
                        },
                    ],
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                },
            }),
        },
    );

    if (!response.ok) {
        throw new Error(`Gemini Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Parse structured output
    const parsed = parseOcrResponse(rawResponse, ocrType);

    return {
        extracted: parsed.extracted,
        confidence: parsed.confidence,
        rawResponse,
    };
}

/**
 * Build OCR prompt based on type
 */
function buildOcrPrompt(ocrType: string): string {
    if (ocrType === "medical_prescription") {
        return `Analyze this medical document/prescription image.
Extract the following in JSON format:
{
  "type": "medical_prescription",
  "items": [
    {
      "drug_name": "string",
      "dose": "string or null",
      "quantity": "number or null",
      "instructions": "string or null"
    }
  ],
  "patient_name": "string or null",
  "doctor_name": "string or null",
  "hospital_name": "string or null",
  "date": "string or null",
  "text_full": "string - full text visible"
}
Also include a "confidence" field (0-1) indicating your confidence in the extraction accuracy.
If the image is unclear or you cannot extract information, set confidence low and include what you can read in text_full.`;
    }

    return `Analyze this image and extract all visible text and information.
Return JSON format:
{
  "type": "general_document",
  "text_full": "string - all visible text",
  "items": [
    {
      "name": "string",
      "details": "string or null"
    }
  ],
  "confidence": 0.0-1.0
}`;
}

/**
 * Parse OCR response into structured format
 */
function parseOcrResponse(
    response: string,
    ocrType: string,
): { extracted: Record<string, unknown>; confidence: number } {
    try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/```(?:json)?[\s\S]*?({[\s\S]+?})[\s\S]*?```/) ||
            response.match(/({[\s\S]+})/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return {
                extracted: parsed,
                confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
            };
        }

        // Fallback: return raw text
        return {
            extracted: {
                type: ocrType,
                text_full: response,
                extraction_failed: true,
            },
            confidence: 0.3,
        };
    } catch {
        return {
            extracted: {
                type: ocrType,
                text_full: response,
                parse_error: true,
            },
            confidence: 0.2,
        };
    }
}

/**
 * Check if OCR confidence is sufficient to auto-proceed
 */
export function isConfidenceSufficient(confidence: number): boolean {
    return confidence >= CONFIDENCE_THRESHOLD;
}
