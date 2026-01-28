/**
 * Moltbot Coded Workflows — Deterministic Fallback
 *
 * Workflow 12, Phase A: Non-AI workflows that run when:
 * - AI is disabled (feature flag off)
 * - Phone not in allowlist
 * - AI output validation fails
 * - AI call errors
 *
 * All functions are idempotent and auditable.
 *
 * @module moltbot/coded-workflows
 */

import type { MoltbotOutput, AskClientOutput, VendorOutreachPlanOutput, ShortlistOutput, EscalateOutput } from "./output-validator.ts";

// Re-export RequestState from validator
export type { RequestState } from "./output-validator.ts";

// ============================================================================
// Types
// ============================================================================

export interface MoltbotRequest {
    id: string;
    conversation_id: string;
    state: string;
    requirements: Record<string, unknown>;
    shortlist: unknown[];
    error_reason: string | null;
}

export interface MoltbotContextPack {
    conversation: {
        id: string;
        clientPhone: string;
        language: string;
        recentMessages: Array<{ role: "client" | "bot"; text: string; timestamp: string }>;
    };
    request: MoltbotRequest | null;
    ocrData?: {
        extracted: Record<string, unknown>;
        confidence: number;
    };
    vendorReplies?: Array<{
        vendorId: string;
        vendorName: string;
        vendorPhone: string;
        responseText: string;
        responseData: Record<string, unknown>;
    }>;
}

// ============================================================================
// Coded Workflows
// ============================================================================

export const codedWorkflows = {
    /**
     * Collect requirements from client
     * Triggered in: collecting_requirements state
     */
    collectRequirements(context: MoltbotContextPack): MoltbotOutput {
        const lastMessage = context.conversation.recentMessages.slice(-1)[0];
        const requirements = context.request?.requirements ?? {};

        // Check what we have and what we need
        const hasCategory = !!requirements.category;
        const hasItem = !!requirements.item_description;

        // If we have enough, move to vendor outreach
        if (hasCategory && hasItem) {
            return this.createVendorOutreachPlan(requirements);
        }

        // Ask for missing info
        if (!hasCategory) {
            return this.askClient(
                "What type of product or service are you looking for?",
                "Need to know category to find suitable vendors",
                ["Medicine/Pharmacy", "Electronics", "Food", "Services", "Other"]
            );
        }

        if (!hasItem) {
            return this.askClient(
                `What specific ${requirements.category} item do you need?`,
                "Need specific item to match with vendor inventory"
            );
        }

        // Default: ask for clarification
        return this.askClient(
            "Could you please describe what you're looking for?",
            "Unable to parse request from last message"
        );
    },

    /**
     * Process OCR result
     * Triggered in: ocr_processing state
     */
    processOcrResult(context: MoltbotContextPack): MoltbotOutput {
        const ocrData = context.ocrData;

        if (!ocrData) {
            return this.askClient(
                "I couldn't read the image clearly. Could you describe what you need?",
                "OCR data missing"
            );
        }

        // Low confidence = ask for confirmation
        if (ocrData.confidence < 0.75) {
            const items = Object.entries(ocrData.extracted)
                .filter(([k]) => k !== "confidence")
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n");

            return this.askClient(
                `I read the following from your image. Is this correct?\n\n${items}`,
                `OCR confidence ${(ocrData.confidence * 100).toFixed(0)}% below threshold`,
                ["Yes, that's correct", "No, let me clarify"]
            );
        }

        // High confidence = proceed to vendor outreach
        const requirements = {
            ...context.request?.requirements,
            ...ocrData.extracted,
            source: "ocr",
        };

        return this.createVendorOutreachPlan(requirements);
    },

    /**
     * Handle vendor outreach / awaiting replies
     */
    handleVendorOutreach(context: MoltbotContextPack): MoltbotOutput {
        const replies = context.vendorReplies ?? [];

        // No replies yet = wait
        if (replies.length === 0) {
            return this.askClient(
                "I'm still waiting for vendor responses. I'll update you as soon as I hear back.",
                "No vendor replies yet"
            );
        }

        // Have replies = generate shortlist
        return this.generateShortlist(context);
    },

    /**
     * Generate shortlist from vendor replies
     */
    generateShortlist(context: MoltbotContextPack): MoltbotOutput {
        const replies = context.vendorReplies ?? [];

        if (replies.length === 0) {
            return this.escalateToHuman("No vendor replies received after outreach");
        }

        // Build shortlist items
        const items = replies.map((reply) => ({
            vendor_id: reply.vendorId,
            vendor_name: reply.vendorName,
            vendor_phone: reply.vendorPhone,
            response_summary: reply.responseText.slice(0, 200),
            price: this.extractPrice(reply.responseText),
        }));

        // Sort by price if available
        items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

        // Take top 5
        const topItems = items.slice(0, 5);

        const shortlist: ShortlistOutput = {
            type: "shortlist",
            summary_text: `I found ${topItems.length} option${topItems.length !== 1 ? "s" : ""} for you:`,
            items: topItems,
            handoff: {
                type: "wa_link",
            },
        };

        return shortlist;
    },

    /**
     * Create vendor outreach plan
     */
    createVendorOutreachPlan(requirements: Record<string, unknown>): VendorOutreachPlanOutput {
        const category = String(requirements.category ?? "general");
        const item = String(requirements.item_description ?? requirements.item ?? "item");

        return {
            type: "vendor_outreach_plan",
            category,
            normalized_need: item,
            batch_size: 5,
            vendor_questions: [
                `1. Do you have ${item} in stock?`,
                "2. What is the price?",
                "3. Is delivery available?",
            ],
            stop_conditions: {
                max_vendors: 15,
                min_replies: 3,
                timeout_hours: 0.5,
            },
            calling_allowed: false,
        };
    },

    /**
     * Ask client for clarification
     */
    askClient(question: string, why: string, options?: string[]): AskClientOutput {
        return {
            type: "ask_client",
            question_text: question,
            why,
            options,
        };
    },

    /**
     * Escalate to human support
     */
    escalateToHuman(reason: string): EscalateOutput {
        return {
            type: "escalate",
            reason,
            safe_client_message: "Let me connect you with a team member who can help. Someone will be with you shortly.",
            to: "human",
        };
    },

    /**
     * Extract price from text
     */
    extractPrice(text: string): number | undefined {
        // Match patterns like: 500, 500 RWF, RWF 500, 1,500, RWF1500
        // Prioritize numbers near RWF marker, else take largest number
        const rwfPatterns = text.match(/RWF\s*(\d+(?:,\d{3})*)|(\d+(?:,\d{3})*)\s*RWF/gi);
        if (rwfPatterns && rwfPatterns.length > 0) {
            const numMatch = rwfPatterns[0].match(/(\d+(?:,\d{3})*)/);
            if (numMatch) {
                return parseInt(numMatch[1].replace(/,/g, ""), 10);
            }
        }

        // Fallback: find all numbers and return the largest reasonable one
        const allNumbers = text.match(/\d+(?:,\d{3})*/g);
        if (allNumbers) {
            const parsed = allNumbers
                .map((n) => parseInt(n.replace(/,/g, ""), 10))
                .filter((n) => !isNaN(n) && n > 0 && n < 1_000_000);
            if (parsed.length > 0) {
                return Math.max(...parsed);
            }
        }
        return undefined;
    },
};
