/**
 * Moltbot Orchestrator — Unified Loop
 *
 * Workflow 12, Phase A: Context pack → Moltbot AI → Validate → Execute tools
 * Falls back to coded workflows on validation failure or AI disabled.
 *
 * @module moltbot/orchestrator
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isEnabled } from "../feature-flags-db.ts";
import { writeAuditEvent } from "../security/audit-logger.ts";
import { codedWorkflows, type RequestState, type MoltbotRequest } from "./coded-workflows.ts";
import { validateOutputContract, type MoltbotOutput } from "./output-validator.ts";

// ============================================================================
// Types
// ============================================================================

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

export interface OrchestratorResult {
    success: boolean;
    mode: "ai" | "coded";
    action?: MoltbotOutput;
    error?: string;
    nextState?: RequestState;
}

// ============================================================================
// Moltbot Orchestrator
// ============================================================================

export class MoltbotOrchestrator {
    constructor(private supabase: SupabaseClient) { }

    /**
     * Main orchestration loop
     */
    async processRequest(contextPack: MoltbotContextPack): Promise<OrchestratorResult> {
        const startTime = Date.now();

        try {
            // Check feature flags
            const aiEnabled = await isEnabled(this.supabase, "AI_CONCIERGE_ENABLED");
            const isAllowlisted = await this.checkAllowlist(contextPack.conversation.clientPhone);

            // Use AI only if enabled AND phone is allowlisted (or no allowlist enforcement)
            const useAi = aiEnabled && isAllowlisted;

            await writeAuditEvent(this.supabase, {
                event_type: "moltbot_orchestrator_start",
                actor: "system",
                metadata: {
                    conversationId: contextPack.conversation.id,
                    requestId: contextPack.request?.id,
                    useAi,
                    aiEnabled,
                    isAllowlisted,
                },
            });

            let result: OrchestratorResult;

            if (useAi) {
                result = await this.processWithAi(contextPack);
            } else {
                result = await this.processWithCodedWorkflow(contextPack);
            }

            // Log completion
            await writeAuditEvent(this.supabase, {
                event_type: "moltbot_orchestrator_complete",
                actor: "system",
                metadata: {
                    conversationId: contextPack.conversation.id,
                    mode: result.mode,
                    success: result.success,
                    durationMs: Date.now() - startTime,
                },
            });

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            await writeAuditEvent(this.supabase, {
                event_type: "moltbot_orchestrator_error",
                actor: "system",
                metadata: {
                    conversationId: contextPack.conversation.id,
                    error: errorMessage,
                    durationMs: Date.now() - startTime,
                },
            });

            // Fall back to coded workflow on any error
            return this.processWithCodedWorkflow(contextPack);
        }
    }

    /**
     * Process using AI (Moltbot via Gemini)
     */
    private async processWithAi(contextPack: MoltbotContextPack): Promise<OrchestratorResult> {
        try {
            // Build prompt from skill files
            const prompt = await this.buildMoltbotPrompt(contextPack);

            // Call Gemini
            const aiResponse = await this.callGemini(prompt);

            // Parse JSON from response
            const parsed = this.extractJsonFromResponse(aiResponse);

            if (!parsed) {
                console.warn("[MoltbotOrchestrator] Failed to extract JSON from AI response, falling back");
                return this.processWithCodedWorkflow(contextPack);
            }

            // Validate against output contract
            const validation = validateOutputContract(parsed);

            if (!validation.valid) {
                console.warn("[MoltbotOrchestrator] Invalid AI output:", validation.errors);
                await writeAuditEvent(this.supabase, {
                    event_type: "moltbot_validation_failure",
                    actor: "system",
                    metadata: {
                        conversationId: contextPack.conversation.id,
                        errors: validation.errors,
                        rawOutput: JSON.stringify(parsed).slice(0, 500),
                    },
                });
                return this.processWithCodedWorkflow(contextPack);
            }

            // Execute action
            const action = parsed as MoltbotOutput;
            const nextState = await this.executeAction(action, contextPack);

            return {
                success: true,
                mode: "ai",
                action,
                nextState,
            };
        } catch (error) {
            console.error("[MoltbotOrchestrator] AI processing failed:", error);
            return this.processWithCodedWorkflow(contextPack);
        }
    }

    /**
     * Process using coded (deterministic) workflows
     */
    private async processWithCodedWorkflow(
        contextPack: MoltbotContextPack
    ): Promise<OrchestratorResult> {
        const request = contextPack.request;

        // Determine which coded workflow to run based on state
        const currentState: RequestState = request?.state ?? "collecting_requirements";

        let action: MoltbotOutput;
        let nextState: RequestState;

        switch (currentState) {
            case "collecting_requirements":
                action = codedWorkflows.collectRequirements(contextPack);
                nextState = action.type === "vendor_outreach_plan" ? "vendor_outreach" : "collecting_requirements";
                break;

            case "ocr_processing":
                action = codedWorkflows.processOcrResult(contextPack);
                nextState = action.type === "vendor_outreach_plan" ? "vendor_outreach" : "collecting_requirements";
                break;

            case "vendor_outreach":
            case "awaiting_vendor_replies":
                action = codedWorkflows.handleVendorOutreach(contextPack);
                nextState = action.type === "shortlist" ? "shortlist_ready" : "awaiting_vendor_replies";
                break;

            case "shortlist_ready":
                action = codedWorkflows.generateShortlist(contextPack);
                nextState = "handed_off";
                break;

            default:
                action = codedWorkflows.escalateToHuman("Unhandled request state: " + currentState);
                nextState = "error";
        }

        // Execute the action
        await this.executeAction(action, contextPack);

        return {
            success: true,
            mode: "coded",
            action,
            nextState,
        };
    }

    /**
     * Check if phone is in allowlist
     */
    private async checkAllowlist(phone: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from("moltbot_allowlist")
            .select("enabled")
            .eq("phone", phone)
            .eq("enabled", true)
            .maybeSingle();

        if (error) {
            console.warn("[MoltbotOrchestrator] Allowlist check failed:", error);
            // Default to allowing if table doesn't exist (no allowlist enforcement)
            if (error.code === "PGRST116") {
                return true;
            }
            return false;
        }

        // If no entry found and table exists, phone is not allowlisted
        // For pilot: require explicit allowlist entry
        return !!data?.enabled;
    }

    /**
     * Build Moltbot prompt from context
     */
    private async buildMoltbotPrompt(contextPack: MoltbotContextPack): Promise<string> {
        const { conversation, request, ocrData, vendorReplies } = contextPack;

        let prompt = `You are Moltbot Marketplace Concierge. Respond with ONLY a valid JSON object.

## Current State
- Conversation ID: ${conversation.id}
- Language: ${conversation.language}
- Request State: ${request?.state ?? "new"}

## Recent Messages
${conversation.recentMessages.map((m) => `[${m.role}]: ${m.text}`).join("\n")}

## Requirements
${JSON.stringify(request?.requirements ?? {}, null, 2)}
`;

        if (ocrData) {
            prompt += `\n## OCR Data (confidence: ${ocrData.confidence})
${JSON.stringify(ocrData.extracted, null, 2)}
`;
        }

        if (vendorReplies && vendorReplies.length > 0) {
            prompt += `\n## Vendor Replies
${vendorReplies.map((v) => `- ${v.vendorName}: ${v.responseText}`).join("\n")}
`;
        }

        prompt += `\n## Instructions
Output EXACTLY ONE JSON object matching the output contract. Types: ask_client, vendor_outreach_plan, shortlist, escalate.
`;

        return prompt;
    }

    /**
     * Call Gemini API
     */
    private async callGemini(prompt: string): Promise<string> {
        const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_AI_API_KEY");

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not configured");
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.8,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    /**
     * Extract JSON from AI response
     */
    private extractJsonFromResponse(response: string): unknown {
        // Try direct parse
        try {
            return JSON.parse(response);
        } catch {
            // Try to extract JSON from markdown code block
            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1]);
                } catch {
                    // Ignore
                }
            }

            // Try to find JSON object
            const objMatch = response.match(/\{[\s\S]*\}/);
            if (objMatch) {
                try {
                    return JSON.parse(objMatch[0]);
                } catch {
                    // Ignore
                }
            }

            return null;
        }
    }

    /**
     * Execute action (send message, update state, etc.)
     */
    private async executeAction(
        action: MoltbotOutput,
        contextPack: MoltbotContextPack
    ): Promise<RequestState> {
        const requestId = contextPack.request?.id;

        switch (action.type) {
            case "ask_client":
                await this.sendClientMessage(contextPack.conversation.clientPhone, action.question_text);
                return "collecting_requirements";

            case "vendor_outreach_plan":
                if (requestId) {
                    await this.updateRequestState(requestId, "vendor_outreach");
                    await this.createVendorOutreach(requestId, action);
                }
                return "vendor_outreach";

            case "shortlist":
                await this.sendClientMessage(contextPack.conversation.clientPhone, this.formatShortlistMessage(action));
                if (requestId) {
                    await this.updateRequestState(requestId, "handed_off");
                }
                return "handed_off";

            case "escalate":
                await this.sendClientMessage(contextPack.conversation.clientPhone, action.safe_client_message);
                if (requestId) {
                    await this.updateRequestState(requestId, "error", action.reason);
                }
                return "error";

            default:
                return "error";
        }
    }

    /**
     * Send message to client via WhatsApp
     */
    private async sendClientMessage(phone: string, text: string): Promise<void> {
        // Queue outbound message (actual sending handled by messaging layer)
        await this.supabase.from("moltbot_conversation_messages").insert({
            conversation_id: await this.getConversationId(phone),
            provider_message_id: `out_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            direction: "outbound",
            message_type: "text",
            body: text,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Get conversation ID for phone
     */
    private async getConversationId(phone: string): Promise<string> {
        const { data } = await this.supabase
            .from("moltbot_conversations")
            .select("id")
            .eq("client_phone", phone)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        return data?.id ?? "";
    }

    /**
     * Update request state
     */
    private async updateRequestState(
        requestId: string,
        state: RequestState,
        errorReason?: string
    ): Promise<void> {
        await this.supabase
            .from("moltbot_marketplace_requests")
            .update({
                state,
                error_reason: errorReason ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", requestId);
    }

    /**
     * Create vendor outreach records
     */
    private async createVendorOutreach(
        requestId: string,
        plan: Extract<MoltbotOutput, { type: "vendor_outreach_plan" }>
    ): Promise<void> {
        // Select vendors based on plan
        const { data: vendors } = await this.supabase
            .from("vendors")
            .select("id, name, phone")
            .eq("category", plan.category)
            .eq("active", true)
            .limit(plan.batch_size);

        if (!vendors?.length) return;

        // Create outreach records
        const outreach = vendors.map((v) => ({
            request_id: requestId,
            vendor_id: v.id,
            state: "queued",
            outreach_message: plan.vendor_questions.join("\n"),
        }));

        await this.supabase.from("moltbot_vendor_outreach").upsert(outreach, {
            onConflict: "request_id,vendor_id",
        });
    }

    /**
     * Format shortlist as WhatsApp message
     */
    private formatShortlistMessage(shortlist: Extract<MoltbotOutput, { type: "shortlist" }>): string {
        let msg = `${shortlist.summary_text}\n\n`;

        shortlist.items.forEach((item, i) => {
            const waLink = `https://wa.me/${item.vendor_phone.replace(/[^0-9]/g, "")}`;
            msg += `${i + 1}. *${item.vendor_name}*\n`;
            msg += `   ${item.response_summary}\n`;
            if (item.price) msg += `   💰 ${item.price} RWF\n`;
            msg += `   📱 ${waLink}\n\n`;
        });

        return msg.trim();
    }
}
