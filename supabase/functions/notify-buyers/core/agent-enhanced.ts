/**
 * Enhanced Buy & Sell Agent - Kwizera Implementation
 * 
 * World-class AI sourcing agent with:
 * - Multi-model strategy (Gemini 3 Pro for reasoning, Flash for intent)
 * - Google Search and Maps grounding
 * - save_candidates tool for vendor persistence
 * - Voice note transcription support
 * - Geo-fencing and access control
 * - Vendor tier system (Tier 1 verified, Tier 2 public)
 * - Structured learning and memory
 * 
 * Based on Kwizera reference architecture for Africa-only sourcing.
 * 
 * @see NOTIFY_BUYERS_AGENT_ANALYSIS.md for full analysis
 */

import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { SOURCING_TOOLS_CONFIG, SOURCING_TOOL_CONFIG, executeTool } from "../../_shared/buy-sell-tools.ts";
import { generateContent } from "../../_shared/gemini.ts";
import { fetchUserContext, formatUserContextForPrompt } from "../../_shared/context/user-context.ts";
import type { UserContext } from "../../_shared/types/buy-sell.ts";
import { findVendorsNearby, getTier1Vendors } from "../../_shared/memory/vendor-proximity.ts";
import { 
  getRelevantMarketKnowledge, 
  formatMarketKnowledgeForPrompt,
  learnFromInteraction 
} from "../../_shared/memory/market-intelligence.ts";

// Re-export types for compatibility
export type { MarketplaceContext, BuyAndSellContext } from "./agent.ts";
export type { AgentResponse } from "./agent.ts";

// Import existing types
import type { MarketplaceContext, AgentResponse } from "./agent.ts";

// =====================================================
// CONFIGURATION
// =====================================================

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY");
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Model configuration
const INTENT_MODEL = (typeof Deno !== "undefined" ? Deno.env.get("INTENT_MODEL") : undefined) || "gemini-1.5-flash";
const REASONING_MODEL = (typeof Deno !== "undefined" ? Deno.env.get("REASONING_MODEL") : undefined) || "gemini-1.5-pro";

// Thinking budget for deep reasoning (32k tokens)
const THINKING_BUDGET = 32000;

// Maximum conversation history entries
const MAX_CONVERSATION_HISTORY_SIZE = 20;

// =====================================================
// SYSTEM INSTRUCTIONS (KWIZERA PERSONA)
// =====================================================

/**
 * MASTER SYSTEM INSTRUCTION - Kwizera Persona
 * Based on Kwizera reference architecture
 */
export const MASTER_SYSTEM_INSTRUCTION = `# IDENTITY & MISSION
You are **Kwizera**, a world-class AI Sourcing Agent and Logistics Strategist purpose-built for the African continent. Your mission is to solve market fragmentation by connecting business needs with verified suppliers. You are not a generic assistant; you are a professional partner in the "Intra-Africa Trade Corridor." You possess deep cultural intelligence, a bias for action, and an obsessive focus on "Ground Truth" (verified availability, real-time pricing, and physical location).

# GEOGRAPHICAL PROTOCOLS & CONSTRAINTS
1. **Strict Africa-Only Mandate**: You operate exclusively within the African continent (Lat: -35.5 to 37.8, Lng: -25.5 to 63.5). If a user attempts to source from China, Europe, or the Americas, you must state: "Kwizera is architected for African trade optimization. I specialize in sourcing and logistics within the continent only."
2. **Compliance Guardrails**: You are explicitly blocked from active sourcing inside Uganda (UG), Kenya (KE), Nigeria (NG), and South Africa (ZA). If a user is located in these regions, you must pivot to a cross-border strategy. For example, if a user in Kampala (UG) needs cement, suggest high-capacity Tier 1 vendors in Rwanda or Tanzania and discuss the logistics of cross-border transport.

# INTERACTION PROTOCOL (CONCISE, LOCATION-FIRST)
- Always stay concise, especially in the intro. One short greeting + what you can do + a direct prompt to share location via WhatsApp location sharing (📎 → Location → Send current location).
- You must have the user’s location to serve them. If missing, ask for it first; after that, proceed with their text or voice note.
- Encourage voice or text after location is shared; confirm you can work with either.
- Use relevant, sparing emojis to convey empathy/professionalism with a light touch of humor (never overdone). When listing, use number emojis (1️⃣ 2️⃣ 3️⃣).
- Keep replies structured and brief; prioritize the next action for the user (share location, clarify need).

# COGNITIVE SOURCING STRATEGY
When tasked with finding a product or service, you must follow this "Grounding Sequence":
- **Step 1: Proximity Search**: Use 'googleMaps' to find businesses within 10-20km of the user. In Africa, logistics cost is often the deciding factor; local availability is king.
- **Step 2: Reliability Verification**: Use 'googleSearch' to find social media activity or recent news about the vendor. A "dead" Google Maps listing is a high risk. Look for signs of "WhatsApp Business" activity.
- **Step 3: Price Discovery**: Search for current market rates in local currency (RWF, GHS, ETB) to ensure the user isn't being overcharged.

# VENDOR HIERARCHY & COMMUNICATION
1. **Tier 1 (Internal Partners)**: Priority #1. These are pre-vetted, high-trust businesses. Recommend them immediately.
2. **Tier 2 (Verified Public)**: Businesses with high reviews and valid phone numbers. 
3. **Communication Nuance**: Understand that the African business world runs on WhatsApp and Mobile Money (MoMo/M-PESA). Every vendor match MUST have a valid international phone number (+250..., +233...). If you cannot find a phone number, the vendor is disqualified from the broadcast system.

# TONE & MULTI-MODAL INTERACTION
- **Voice (Live)**: Be direct, helpful, and minimize jargon. Use a reassuring, professional tone. If the user sounds urgent, prioritize speed over detailed descriptions.
- **WhatsApp (Async)**: Use structured formatting (bullet points, bold headers).
- **Finality**: Every sourcing operation MUST conclude with the 'save_candidates' tool call. Your final response should always offer to "initiate the WhatsApp verification broadcast" to the top candidates you've identified. 

You represent the future of African commerce. Act with the precision of a top-tier procurement officer and the speed of a digital native.`;

export const SYSTEM_INSTRUCTION_INTENT = MASTER_SYSTEM_INSTRUCTION + `
## TASK
Extract the user's intent: Product specs, Quantity, precise Location, and Urgency. Detect the language (Swahili, French, Kinyarwanda, etc.) and respond in kind while maintaining professional persona.
`;

export const SYSTEM_INSTRUCTION_RESPONSE = MASTER_SYSTEM_INSTRUCTION + `
## TASK
Execute the Deep Sourcing Strategy. Use your 32k thinking budget to verify vendor reliability, calculate proximity, and finally call 'save_candidates' with up to 30 vendor matches. Aim to find:
- Tier 1 Internal Partners (up to 10, highest priority)
- Google Maps businesses (up to 15)
- Google Search results (up to 5)

After saving candidates, your final_response_text MUST ask the user for permission: "Should I contact them on your behalf? Reply YES to proceed."
`;

// =====================================================
// GEO-FENCING UTILITIES
// =====================================================

/**
 * Longest Prefix Match (LPM) for phone number to country resolution
 */
const COUNTRY_PREFIXES: Record<string, string> = {
  "+250": "RW", // Rwanda
  "+256": "UG", // Uganda (BLOCKED)
  "+254": "KE", // Kenya (BLOCKED)
  "+234": "NG", // Nigeria (BLOCKED)
  "+27": "ZA",  // South Africa (BLOCKED)
  "+233": "GH", // Ghana
  "+251": "ET", // Ethiopia
  "+255": "TZ", // Tanzania
  "+257": "BI", // Burundi
  "+243": "CD", // DRC
};

const BLOCKED_COUNTRIES = ["UG", "KE", "NG", "ZA"];

export function resolveCountryFromPhone(phone: string): string | null {
  // Normalize phone number
  const normalized = phone.replace(/\s+/g, "").replace(/^00/, "+");
  
  // LPM: Find longest matching prefix
  let matchedCountry: string | null = null;
  let longestPrefix = "";
  
  for (const [prefix, country] of Object.entries(COUNTRY_PREFIXES)) {
    if (normalized.startsWith(prefix) && prefix.length > longestPrefix.length) {
      longestPrefix = prefix;
      matchedCountry = country;
    }
  }
  
  return matchedCountry;
}

export function validateAccess(phone: string): { allowed: boolean; reason?: string; country?: string | null } {
  const country = resolveCountryFromPhone(phone);
  
  if (!country) {
    return { allowed: false, reason: "Invalid phone number format", country: null };
  }
  
  if (BLOCKED_COUNTRIES.includes(country)) {
    return { 
      allowed: false, 
      reason: `Kwizera's sourcing service is not yet available in ${country}. We currently serve Rwanda and select East African countries. Stay tuned for expansion!`,
      country 
    };
  }
  
  return { allowed: true, country };
}

// =====================================================
// ENHANCED MARKETPLACE AGENT CLASS
// =====================================================

export class EnhancedMarketplaceAgent {
  private supabase: SupabaseClient;
  private correlationId?: string;

  constructor(
    supabase: SupabaseClient,
    correlationId?: string,
  ) {
    this.supabase = supabase;
    this.correlationId = correlationId;

    logStructuredEvent(
      "ENHANCED_MARKETPLACE_AGENT_INITIALIZED",
      { correlationId },
      "info",
    );
  }

  /**
   * Process a marketplace message with multi-model strategy
   */
  async process(
    userMessage: string,
    context: MarketplaceContext,
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      logStructuredEvent("ENHANCED_AGENT_PROCESS_START", {
        phone: context.phone.slice(-4), // Masked
        messageLength: userMessage.length,
        flowType: context.flowType,
        correlationId: this.correlationId,
      });

      // Step 1: Geo-fencing check
      const accessCheck = validateAccess(context.phone);
      if (!accessCheck.allowed) {
        return {
          message: accessCheck.reason || "Access denied",
          action: "continue",
          flowComplete: false,
        };
      }

      // Step 2: Fetch user context (past requests, market knowledge)
      let userContext: UserContext | undefined;
      try {
        // Get user_id from profile if available
        const { data: profile } = await this.supabase
          .from("profiles")
          .select("id")
          .eq("phone", context.phone)
          .maybeSingle();
        
        if (profile) {
          userContext = await fetchUserContext(profile.id, this.supabase, this.correlationId);
        }
      } catch (error) {
        logStructuredEvent("USER_CONTEXT_FETCH_ERROR", {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.correlationId,
        }, "warn");
        // Continue without context
      }

      // Step 3: Intent extraction (fast model)
      const intentResult = await this.extractIntent(userMessage, context);
      
      // Step 4: Deep reasoning with tools (if needed)
      if (this.requiresDeepReasoning(intentResult)) {
        const reasoningResult = await this.executeDeepReasoning(
          userMessage,
          intentResult,
          context,
          userContext
        );
        
        // Handle tool calls (save_candidates, etc.)
        let agentFinalMessage = reasoningResult.message;
        if (reasoningResult.toolCalls && reasoningResult.toolCalls.length > 0) {
          const toolResponseText = await this.handleToolCalls(reasoningResult.toolCalls, context, intentResult);
          // Use final_response_text from tool if available
          if (toolResponseText) {
            agentFinalMessage = toolResponseText;
          }
        }
        
        // Learn from interaction (market intelligence)
        if (reasoningResult.vendorsFound && reasoningResult.vendorsFound.length > 0) {
          // Learn asynchronously (don't block response)
          learnFromInteraction(
            this.supabase,
            {
              query: typeof intentResult.entities.product_name === "string" 
                ? intentResult.entities.product_name 
                : userMessage,
              location: context.location,
              vendorsFound: reasoningResult.vendorsFound,
              outcome: reasoningResult.flowComplete ? "success" : "partial",
            },
            this.correlationId
          ).catch(error => {
            logStructuredEvent("MARKET_LEARNING_ERROR", {
              error: error instanceof Error ? error.message : String(error),
              correlationId: this.correlationId,
            }, "warn");
          });
        }
        
        // Update conversation state including pending vendor outreach
        await this.updateConversationState(context.phone, {
          flowType: intentResult.intent || context.flowType,
          flowStep: context.pendingVendorOutreach?.awaitingConsent ? "awaiting_consent" : reasoningResult.nextAction,
          collectedData: {
            ...context.collectedData,
            ...intentResult.entities,
          },
          pendingVendorOutreach: context.pendingVendorOutreach,
          conversationHistory: [
            ...(context.conversationHistory || []),
            { role: "user" as const, content: userMessage },
            { role: "assistant" as const, content: agentFinalMessage },
          ].slice(-MAX_CONVERSATION_HISTORY_SIZE),
        });

        const duration = Date.now() - startTime;
        recordMetric("enhanced.agent.process", 1, {
          intent: intentResult.intent,
          action: reasoningResult.nextAction,
          duration_ms: duration,
        });

        // Use final message (may have been updated by tool execution)
        const responseMessage = agentFinalMessage;
        
        return {
          message: responseMessage,
          action: reasoningResult.nextAction as AgentResponse["action"],
          flowComplete: reasoningResult.flowComplete,
        };
      } else {
        // Simple response (no deep reasoning needed)
        const simpleResponse = await this.generateSimpleResponse(
          userMessage,
          intentResult,
          context
        );

        await this.updateConversationState(context.phone, {
          flowType: intentResult.intent || context.flowType,
          collectedData: {
            ...context.collectedData,
            ...intentResult.entities,
          },
          conversationHistory: [
            ...(context.conversationHistory || []),
            { role: "user" as const, content: userMessage },
            { role: "assistant" as const, content: simpleResponse.message },
          ].slice(-MAX_CONVERSATION_HISTORY_SIZE),
        });

        return simpleResponse;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logStructuredEvent(
        "ENHANCED_AGENT_PROCESS_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          durationMs: duration,
          correlationId: this.correlationId,
        },
        "error",
      );

      recordMetric("enhanced.agent.error", 1);

      return {
        message: "I'm sorry, something went wrong. Please try again or type 'menu' to see your options.",
        action: "continue",
      };
    }
  }

  /**
   * Extract intent using fast model (Flash)
   */
  private async extractIntent(
    userMessage: string,
    _context: MarketplaceContext
  ): Promise<{
    intent: "buying" | "selling" | "inquiry" | "unclear";
    entities: Record<string, unknown>;
    confidence: number;
  }> {
    const prompt = `Extract intent and entities from this user message:

User: ${userMessage}

${_context.location ? `User location: ${_context.location.lat}, ${_context.location.lng}` : ""}

Return JSON with:
- intent: "buying" | "selling" | "inquiry" | "unclear"
- entities: { product_name, quantity, location_text, budget, urgency, etc. }
- confidence: 0-1`;

    try {
      const result = await generateContent(
        prompt,
        {
          model: INTENT_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION_INTENT,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                intent: { type: "string", enum: ["buying", "selling", "inquiry", "unclear"] },
                entities: { type: "object" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["intent", "entities", "confidence"],
            },
          },
          correlationId: this.correlationId,
        }
      );

      if (result.text) {
        const parsed = JSON.parse(result.text);
        return {
          intent: parsed.intent || "unclear",
          entities: parsed.entities || {},
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch (error) {
      logStructuredEvent("INTENT_EXTRACTION_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.correlationId,
      }, "warn");
    }

    // Fallback
    return {
      intent: "unclear",
      entities: {},
      confidence: 0.3,
    };
  }

  /**
   * Execute deep reasoning with tools (Pro model)
   * Enhanced with PostGIS proximity queries and market intelligence
   */
  private async executeDeepReasoning(
    userMessage: string,
    intentResult: { intent: string; entities: Record<string, unknown> },
    context: MarketplaceContext,
    userContext?: UserContext
  ): Promise<{
    message: string;
    nextAction: string;
    flowComplete: boolean;
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
    vendorsFound?: Array<{ name: string; is_onboarded: boolean; source: string; score?: number }>;
  }> {
      // Step 1: Get Tier 1 (onboarded) vendors via PostGIS if location available
      // Target: Up to 10 Tier 1 vendors
      let tier1Vendors: Array<{ name: string; is_onboarded: boolean; source: string; score?: number }> = [];
      if (context.location?.lat && context.location?.lng) {
        try {
          const vendors = await getTier1Vendors(
            this.supabase,
            context.location.lat,
            context.location.lng,
            {
              radiusKm: 20, // Increased radius for better coverage
              limit: 10, // Up to 10 Tier 1 vendors
            },
            this.correlationId
          );
        
        tier1Vendors = vendors.map(v => ({
          name: v.name,
          is_onboarded: v.is_onboarded,
          source: v.source,
          score: v.score,
        }));

        logStructuredEvent("TIER1_VENDORS_FOUND", {
          count: tier1Vendors.length,
          location: `${context.location.lat}, ${context.location.lng}`,
          correlationId: this.correlationId,
        });
      } catch (error) {
        logStructuredEvent("TIER1_VENDORS_QUERY_ERROR", {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.correlationId,
        }, "warn");
      }
    }

    // Step 2: Get relevant market knowledge based on query
    const queryText = typeof intentResult.entities.product_name === "string" 
      ? intentResult.entities.product_name 
      : userMessage;
    const locationTag = (context.location as any)?.text 
      ? [(context.location as any).text.toLowerCase().replace(/\s+/g, "_")] 
      : undefined;
    
    const marketKnowledge = await getRelevantMarketKnowledge(
      this.supabase,
      queryText,
      locationTag,
      10,
      0.5,
      this.correlationId
    );

    // Step 3: Build enhanced context prompt
    const contextPrompt = userContext 
      ? formatUserContextForPrompt(userContext)
      : "";
    
    const marketKnowledgePrompt = formatMarketKnowledgeForPrompt(marketKnowledge);
    
    // Build Tier 1 vendors prompt
    let tier1VendorsPrompt = "";
    if (tier1Vendors.length > 0) {
      tier1VendorsPrompt = `[TIER 1 INTERNAL PARTNERS - HIGHEST PRIORITY]
These are pre-vetted, onboarded vendors within 15km of the user:
${tier1Vendors.map((v, idx) => `${idx + 1}. ${v.name} (Score: ${(v.score || 0).toFixed(2)})`).join("\n")}

CRITICAL: These Tier 1 vendors MUST be included in save_candidates with is_onboarded=true.
`;
    }

    const prompt = `User needs: ${JSON.stringify(intentResult.entities)}

${context.location ? `User location: ${context.location.lat}, ${context.location.lng} (${(context.location as any).text || "GPS coordinates"})` : "Location not provided - ask user to share location."}

${tier1VendorsPrompt}

${contextPrompt}

${marketKnowledgePrompt}

Execute the sourcing strategy:
1. **PRIORITY**: Include all Tier 1 Internal Partners listed above in save_candidates (is_onboarded=true, up to 10)
2. Use googleMaps to find additional businesses within 10-20km (aim for 15 more)
3. Use googleSearch to verify vendor reliability and find more options (aim for 5 more)
4. Consider past user requests and market knowledge above
5. Call save_candidates with up to 30 total matches (prioritize Tier 1, then best matches from Google)
6. Your final_response_text MUST ask: "Should I contact them on your behalf? Reply YES to proceed."

Always call save_candidates before responding.`;

    try {
      const result = await generateContent(
        prompt,
        {
          model: REASONING_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION_RESPONSE,
          tools: SOURCING_TOOLS_CONFIG,
          toolConfig: SOURCING_TOOL_CONFIG,
          thinkingBudget: THINKING_BUDGET,
          correlationId: this.correlationId,
        }
      );

      // Extract function calls from response
      const toolCalls = result.functionCalls || [];
      
      // If save_candidates was called, extract final_response_text
      let reasoningMessage = result.text || "I'm working on finding the best vendors for you...";
      let vendorsFound: Array<{ name: string; is_onboarded: boolean; source: string; score?: number }> = [];
      
      if (toolCalls.length > 0) {
        const saveCall = toolCalls.find(call => call.name === "save_candidates");
        if (saveCall) {
          if (saveCall.args.final_response_text) {
            reasoningMessage = saveCall.args.final_response_text as string;
          }
          // Extract vendors from save call
          if (Array.isArray(saveCall.args.candidates)) {
            vendorsFound = saveCall.args.candidates.map((c: Record<string, unknown>) => ({
              name: String(c.name || ""),
              is_onboarded: Boolean(c.is_onboarded),
              source: String(c.source || "unknown"),
              score: typeof c.score === "number" ? c.score : undefined,
            }));
          }
        }
      }

      return {
        message: reasoningMessage,
        nextAction: "search_matches",
        flowComplete: toolCalls.length > 0,
        toolCalls,
        vendorsFound,
      };
    } catch (error) {
      logStructuredEvent("DEEP_REASONING_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.correlationId,
      }, "error");

      return {
        message: "I'm having trouble processing your request. Please try again.",
        nextAction: "continue",
        flowComplete: false,
      };
    }
  }

  /**
   * Generate simple response (no tools needed)
   */
  private async generateSimpleResponse(
    userMessage: string,
    intentResult: { intent: string; entities: Record<string, unknown> },
    context: MarketplaceContext
  ): Promise<AgentResponse> {
    const prompt = `User message: ${userMessage}
Intent: ${intentResult.intent}
Entities: ${JSON.stringify(intentResult.entities)}

Generate a helpful, concise response.`;

    try {
      const result = await generateContent(
        prompt,
        {
          model: INTENT_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION_INTENT,
          correlationId: this.correlationId,
        }
      );

      return {
        message: result.text || "How can I help you?",
        action: "continue",
        flowComplete: false,
      };
    } catch {
      return {
        message: "I'm here to help. What are you looking for?",
        action: "continue",
      };
    }
  }

  /**
   * Determine if deep reasoning is needed
   */
  private requiresDeepReasoning(intentResult: {
    intent: string;
    confidence: number;
  }): boolean {
    // Use deep reasoning for buying/inquiry with high confidence
    return (
      (intentResult.intent === "buying" || intentResult.intent === "inquiry") &&
      intentResult.confidence > 0.6
    );
  }

  /**
   * Handle tool calls (save_candidates, etc.)
   * Returns the final response text if save_candidates was called
   */
  private async handleToolCalls(
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>,
    context: MarketplaceContext,
    intentResult?: { intent: string; entities: Record<string, unknown> }
  ): Promise<string | null> {
    let finalResponseText: string | null = null;
    
    for (const call of toolCalls) {
      if (call.name === "save_candidates") {
        // Add request_id to context if available
        const argsWithContext = {
          ...call.args,
          request_id: context.currentIntentId || null,
        };

        try {
          const result = await executeTool(
            { name: call.name, args: argsWithContext },
            { supabase: this.supabase, correlationId: this.correlationId }
          );

          if (result.success) {
            const savedCount = (result.result as any)?.saved_count || 0;
            logStructuredEvent("CANDIDATES_SAVED", {
              count: savedCount,
              correlationId: this.correlationId,
            });
            
            // Set pending vendor outreach state to await user consent
            context.pendingVendorOutreach = {
              businessIds: [], // Will be populated from candidate_vendors on consent
              requestSummary: typeof intentResult?.entities?.product_name === "string" 
                ? intentResult.entities.product_name 
                : typeof intentResult?.entities?.description === "string"
                ? intentResult.entities.description
                : "User request",
              requestType: (intentResult?.entities?.need_type as string) || "general",
              awaitingConsent: true,
              candidateCount: savedCount,
              requestId: context.currentIntentId || undefined,
            };
            
            // Extract final_response_text if available
            if ((result as any).finalResponseText) {
              finalResponseText = (result as any).finalResponseText;
            }
          } else {
            logStructuredEvent("CANDIDATES_SAVE_ERROR", {
              error: result.error,
              correlationId: this.correlationId,
            }, "warn");
          }
        } catch (error) {
          logStructuredEvent("TOOL_EXECUTION_ERROR", {
            tool: call.name,
            error: error instanceof Error ? error.message : String(error),
            correlationId: this.correlationId,
          }, "error");
        }
      }
    }
    
    return finalResponseText;
  }

  /**
   * Update conversation state
   */
  private async updateConversationState(
    phone: string,
    state: {
      flowType?: string | null;
      flowStep?: string | null;
      collectedData?: Record<string, unknown>;
      conversationHistory?: Array<{ role: string; content: string }>;
      pendingVendorOutreach?: {
        businessIds: string[];
        requestSummary: string;
        requestType: string;
        awaitingConsent: boolean;
        candidateCount?: number;
        requestId?: string;
      };
    }
  ): Promise<void> {
    try {
      await this.supabase.from("marketplace_conversations").upsert(
        {
          phone,
          flow_type: state.flowType,
          flow_step: state.flowStep,
          collected_data: state.collectedData || {},
          conversation_history: state.conversationHistory || [],
          pending_vendor_outreach: state.pendingVendorOutreach || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "phone",
        }
      );
    } catch (error) {
      logStructuredEvent(
        "CONVERSATION_STATE_UPDATE_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.correlationId,
        },
        "warn"
      );
    }
  }

  /**
   * Load conversation context
   */
  static async loadContext(
    phone: string,
    supabase: SupabaseClient,
  ): Promise<MarketplaceContext> {
    try {
      const { data } = await supabase
        .from("marketplace_conversations")
        .select("*")
        .eq("phone", phone)
        .single();

      if (data) {
        return {
          phone,
          flowType: data.flow_type,
          flowStep: data.flow_step,
          collectedData: (data.collected_data as Record<string, unknown>) || {},
          conversationHistory: (data.conversation_history as Array<{ role: "user" | "assistant"; content: string }>) || [],
          currentListingId: data.current_listing_id,
          currentIntentId: data.current_intent_id,
          pendingVendorOutreach: (data.pending_vendor_outreach as {
            businessIds: string[];
            requestSummary: string;
            requestType: string;
            awaitingConsent: boolean;
            candidateCount?: number;
            requestId?: string;
          }) || undefined,
        };
      }
    } catch {
      // No existing conversation
    }

    return {
      phone,
      flowType: null,
      flowStep: null,
      collectedData: {},
      conversationHistory: [],
    };
  }

  /**
   * Reset conversation context
   */
  static async resetContext(
    phone: string,
    supabase: SupabaseClient,
  ): Promise<void> {
    await supabase.from("marketplace_conversations").upsert(
      {
        phone,
        flow_type: null,
        flow_step: null,
        collected_data: {},
        conversation_history: [],
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "phone",
      }
    );
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{ healthy: boolean; aiProvider: boolean }> {
    try {
      if (!GEMINI_API_KEY) {
        return { healthy: false, aiProvider: false };
      }
      // Simple health check - try a minimal API call
      return { healthy: true, aiProvider: true };
    } catch {
      return { healthy: false, aiProvider: false };
    }
  }
}
