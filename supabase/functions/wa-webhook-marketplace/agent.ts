/**
 * Marketplace AI Agent
 *
 * Natural language AI agent for connecting buyers and sellers in Rwanda.
 * Uses Gemini for intent recognition, entity extraction, and conversational flow.
 *
 * Features:
 * - Intent classification (selling, buying, inquiry)
 * - Entity extraction (product, price, location, attributes)
 * - Conversation state management
 * - Proximity-based matching
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// CONFIGURATION
// =====================================================

// AI Model Configuration
const GEMINI_MODEL = Deno.env.get("MARKETPLACE_AI_MODEL") || "gemini-1.5-flash";
const AI_TEMPERATURE = parseFloat(Deno.env.get("MARKETPLACE_AI_TEMPERATURE") || "0.7");
const AI_MAX_TOKENS = parseInt(Deno.env.get("MARKETPLACE_AI_MAX_TOKENS") || "1024", 10);

// =====================================================
// TYPES
// =====================================================

export interface MarketplaceContext {
  phone: string;
  flowType: "selling" | "buying" | "inquiry" | null;
  flowStep: string | null;
  collectedData: Record<string, unknown>;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  location?: { lat: number; lng: number };
  currentListingId?: string | null;
  currentIntentId?: string | null;
}

export interface AgentResponse {
  message: string;
  action?:
    | "create_listing"
    | "search_matches"
    | "connect_users"
    | "ask_location"
    | "ask_price"
    | "ask_description"
    | "ask_photo"
    | "confirm"
    | "continue";
  data?: Record<string, unknown>;
  nextStep?: string;
  flowComplete?: boolean;
}

interface AIResponse {
  response_text: string;
  intent: "selling" | "buying" | "inquiry" | "unclear";
  extracted_entities: {
    product_name?: string | null;
    description?: string | null;
    price?: number | null;
    location_text?: string | null;
    business_type?: string | null;
    attributes?: Record<string, unknown>;
  };
  next_action: string;
  flow_complete: boolean;
}

// =====================================================
// SYSTEM PROMPT
// =====================================================

const SYSTEM_PROMPT = `You are EasyMO Marketplace Agent, a helpful assistant that connects buyers and sellers in Rwanda via WhatsApp.

YOUR CAPABILITIES:
1. Help users SELL products/services by asking the right questions
2. Help users FIND products/services/businesses nearby
3. Connect buyers with sellers based on proximity and needs

SELLING FLOW:
When a user wants to sell something:
- Extract what they're selling (product_name)
- Ask for: description, price, location (if not provided)
- Ask if they want to add photos
- Confirm and create listing

BUYING FLOW:
When a user is looking for something:
- Understand what they need (product, service, or business type)
- Ask for their location if needed for proximity search
- Search and return nearby matches
- Offer to connect them with sellers

RULES:
- Be conversational and friendly
- Use simple language (users may not be tech-savvy)
- Always confirm before creating listings
- Prices are in RWF (Rwandan Francs) by default
- Location is important for matching
- Keep responses concise (max 3-4 sentences per response)
- Use emojis sparingly but effectively

IMPORTANT:
- If user says something unclear, classify intent as "unclear" and ask for clarification
- When selling, always collect: product_name, price, location_text
- For buying, extract what they're looking for and their location preference

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message to the user",
  "intent": "selling|buying|inquiry|unclear",
  "extracted_entities": {
    "product_name": "string or null",
    "description": "string or null",
    "price": "number or null",
    "location_text": "string or null",
    "business_type": "string or null",
    "attributes": {}
  },
  "next_action": "ask_price|ask_location|ask_description|ask_photo|create_listing|search|connect|clarify|continue",
  "flow_complete": false
}`;

// =====================================================
// MARKETPLACE AGENT CLASS
// =====================================================

export class MarketplaceAgent {
  private genAI: GoogleGenerativeAI;
  private supabase: SupabaseClient;
  private correlationId?: string;

  constructor(
    supabase: SupabaseClient,
    apiKey?: string,
    correlationId?: string,
  ) {
    const key = apiKey || Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      throw new Error("GEMINI_API_KEY is required for marketplace agent");
    }
    this.genAI = new GoogleGenerativeAI(key);
    this.supabase = supabase;
    this.correlationId = correlationId;
  }

  /**
   * Process a marketplace message and generate response
   */
  async process(
    userMessage: string,
    context: MarketplaceContext,
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      logStructuredEvent("MARKETPLACE_AGENT_PROCESS_START", {
        phone: context.phone.slice(-4), // Masked
        messageLength: userMessage.length,
        flowType: context.flowType,
        flowStep: context.flowStep,
        correlationId: this.correlationId,
      });

      // Build conversation for AI
      const messages = context.conversationHistory.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

      // Add current message
      messages.push({ role: "user" as const, parts: [{ text: userMessage }] });

      // Build context prompt
      let contextPrompt = "";
      if (
        context.collectedData &&
        Object.keys(context.collectedData).length > 0
      ) {
        contextPrompt = `\n\nCURRENT COLLECTED DATA: ${JSON.stringify(context.collectedData)}`;
      }
      if (context.flowType) {
        contextPrompt += `\nCURRENT FLOW: ${context.flowType}`;
      }
      if (context.flowStep) {
        contextPrompt += `\nCURRENT STEP: ${context.flowStep}`;
      }

      const model = this.genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: SYSTEM_PROMPT + contextPrompt,
      });

      // Start chat with history
      const chat = model.startChat({
        history: messages.slice(0, -1), // All but last message
        generationConfig: {
          temperature: AI_TEMPERATURE,
          maxOutputTokens: AI_MAX_TOKENS,
          responseMimeType: "application/json",
        },
      });

      // Send current message
      const result = await chat.sendMessage(userMessage);
      const responseText = result.response.text();

      // Parse AI response
      let aiResponse: AIResponse;
      try {
        aiResponse = JSON.parse(responseText);
      } catch {
        // Fallback if JSON parsing fails
        logStructuredEvent(
          "MARKETPLACE_AGENT_JSON_PARSE_ERROR",
          {
            responseText: responseText.slice(0, 200),
            correlationId: this.correlationId,
          },
          "warn",
        );
        aiResponse = {
          response_text:
            "I'm sorry, I didn't quite understand that. Could you please rephrase?",
          intent: "unclear",
          extracted_entities: {},
          next_action: "clarify",
          flow_complete: false,
        };
      }

      // Handle actions based on AI response
      const agentResponse = await this.handleAction(aiResponse, context);

      // Update conversation state
      await this.updateConversationState(context.phone, {
        flowType:
          aiResponse.intent === "selling"
            ? "selling"
            : aiResponse.intent === "buying"
              ? "buying"
              : aiResponse.intent === "inquiry"
                ? "inquiry"
                : context.flowType,
        flowStep: aiResponse.next_action,
        collectedData: {
          ...context.collectedData,
          ...this.filterNullValues(aiResponse.extracted_entities),
        },
        conversationHistory: [
          ...context.conversationHistory,
          { role: "user" as const, content: userMessage },
          { role: "assistant" as const, content: agentResponse.message },
        ],
        lastAIResponse: agentResponse.message,
      });

      const duration = Date.now() - startTime;
      logStructuredEvent("MARKETPLACE_AGENT_PROCESS_COMPLETE", {
        phone: context.phone.slice(-4),
        intent: aiResponse.intent,
        action: aiResponse.next_action,
        flowComplete: aiResponse.flow_complete,
        durationMs: duration,
        correlationId: this.correlationId,
      });

      recordMetric("marketplace.agent.process", 1, {
        intent: aiResponse.intent,
        action: aiResponse.next_action,
        duration_ms: duration,
      });

      return agentResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      logStructuredEvent(
        "MARKETPLACE_AGENT_PROCESS_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          durationMs: duration,
          correlationId: this.correlationId,
        },
        "error",
      );

      recordMetric("marketplace.agent.error", 1);

      return {
        message:
          "I'm sorry, something went wrong. Please try again or type 'menu' to see your options.",
        action: "continue",
      };
    }
  }

  /**
   * Handle specific actions based on AI response
   */
  private async handleAction(
    aiResponse: AIResponse,
    context: MarketplaceContext,
  ): Promise<AgentResponse> {
    const action = aiResponse.next_action;
    let message = aiResponse.response_text;
    let data: Record<string, unknown> | undefined;

    // If flow is complete and action is create_listing, create the listing
    if (action === "create_listing" && aiResponse.flow_complete) {
      const mergedData = {
        ...context.collectedData,
        ...aiResponse.extracted_entities,
      };

      if (mergedData.product_name) {
        const listingResult = await this.createListing(
          context.phone,
          mergedData,
        );
        if (listingResult.success) {
          data = { listingId: listingResult.listingId };

          // Notify matching buyers
          await this.notifyMatchingBuyers(listingResult.listingId!);
        } else {
          message =
            "I couldn't create your listing right now. Please try again.";
        }
      }
    }

    // If searching for products/businesses
    if (action === "search" && context.location) {
      const searchTerm =
        aiResponse.extracted_entities.product_name ||
        aiResponse.extracted_entities.business_type ||
        (context.collectedData.looking_for as string);

      if (searchTerm) {
        const results = await this.searchMatches(searchTerm, context.location);
        if (results.length > 0) {
          message += "\n\n" + this.formatSearchResults(results);
        } else {
          message +=
            "\n\nI couldn't find any matches nearby. Would you like me to notify you when something becomes available?";
        }
        data = { results };
      }
    }

    return {
      message,
      action: action as AgentResponse["action"],
      data,
      nextStep: action,
      flowComplete: aiResponse.flow_complete,
    };
  }

  /**
   * Create a new listing
   */
  private async createListing(
    sellerPhone: string,
    data: Record<string, unknown>,
  ): Promise<{ success: boolean; listingId?: string; error?: string }> {
    try {
      const title =
        (data.product_name as string) ||
        (data.title as string) ||
        "Untitled Listing";

      const { data: listing, error } = await this.supabase
        .from("marketplace_listings")
        .insert({
          seller_phone: sellerPhone,
          listing_type: "product",
          title,
          product_name: data.product_name || title,
          description: data.description || null,
          price: data.price || null,
          location_text: data.location_text || null,
          lat: data.lat || null,
          lng: data.lng || null,
          attributes: data.attributes || {},
          status: "active",
        })
        .select("id")
        .single();

      if (error) {
        logStructuredEvent(
          "MARKETPLACE_CREATE_LISTING_ERROR",
          {
            error: error.message,
            correlationId: this.correlationId,
          },
          "error",
        );
        return { success: false, error: error.message };
      }

      logStructuredEvent("MARKETPLACE_LISTING_CREATED", {
        listingId: listing.id,
        productName: data.product_name,
        correlationId: this.correlationId,
      });

      recordMetric("marketplace.listing.created", 1);

      return { success: true, listingId: listing.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Search for matching listings and businesses
   */
  private async searchMatches(
    searchTerm: string,
    location: { lat: number; lng: number },
  ): Promise<Array<Record<string, unknown>>> {
    const results: Array<Record<string, unknown>> = [];

    try {
      // Search marketplace listings
      const { data: listings } = await this.supabase.rpc(
        "search_marketplace_listings_nearby",
        {
          search_term: searchTerm,
          user_lat: location.lat,
          user_lng: location.lng,
          radius_km: 10,
          result_limit: 5,
        },
      );

      if (listings && listings.length > 0) {
        results.push(
          ...listings.map((l: Record<string, unknown>) => ({
            ...l,
            source: "listing",
          })),
        );
      }

      // Search business directory
      const { data: businesses } = await this.supabase.rpc(
        "search_businesses_nearby",
        {
          search_term: searchTerm,
          user_lat: location.lat,
          user_lng: location.lng,
          radius_km: 10,
          result_limit: 5,
        },
      );

      if (businesses && businesses.length > 0) {
        results.push(
          ...businesses.map((b: Record<string, unknown>) => ({
            ...b,
            source: "business",
          })),
        );
      }
    } catch (error) {
      logStructuredEvent(
        "MARKETPLACE_SEARCH_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          searchTerm,
          correlationId: this.correlationId,
        },
        "error",
      );
    }

    // Sort by distance
    return results.sort(
      (a, b) =>
        ((a.distance_km as number) || 999) - ((b.distance_km as number) || 999),
    );
  }

  /**
   * Format search results for WhatsApp message
   */
  private formatSearchResults(
    results: Array<Record<string, unknown>>,
  ): string {
    if (results.length === 0) return "";

    let formatted = "🔍 *Found nearby:*\n\n";

    results.slice(0, 5).forEach((r, i) => {
      const distance = r.distance_km
        ? ` (${Number(r.distance_km).toFixed(1)}km)`
        : "";
      const price = r.price ? ` - ${r.price} ${r.currency || "RWF"}` : "";
      const rating = r.rating ? ` ⭐${r.rating}` : "";

      if (r.source === "listing") {
        formatted += `${i + 1}. *${r.title}*${distance}${price}\n`;
        if (r.description)
          formatted += `   ${(r.description as string).slice(0, 50)}...\n`;
      } else {
        formatted += `${i + 1}. *${r.name}*${distance}${rating}\n`;
        formatted += `   📂 ${r.category} | 📍 ${r.city}\n`;
        if (r.phone) formatted += `   📞 ${r.phone}\n`;
      }
      formatted += "\n";
    });

    formatted +=
      "Reply with a number to get contact details, or describe what else you're looking for.";

    return formatted;
  }

  /**
   * Notify matching buyers when a new listing is created
   */
  private async notifyMatchingBuyers(listingId: string): Promise<void> {
    try {
      // First, get the listing to retrieve seller_phone
      const { data: listing } = await this.supabase
        .from("marketplace_listings")
        .select("seller_phone")
        .eq("id", listingId)
        .single();

      if (!listing) {
        logStructuredEvent(
          "MARKETPLACE_NOTIFY_BUYERS_LISTING_NOT_FOUND",
          { listingId, correlationId: this.correlationId },
          "warn",
        );
        return;
      }

      const { data: matches } = await this.supabase.rpc(
        "find_matching_marketplace_buyers",
        {
          p_listing_id: listingId,
        },
      );

      if (matches && matches.length > 0) {
        logStructuredEvent("MARKETPLACE_MATCHES_FOUND", {
          listingId,
          matchCount: matches.length,
          correlationId: this.correlationId,
        });

        // Create match records
        for (const match of matches) {
          await this.supabase.from("marketplace_matches").insert({
            listing_id: listingId,
            buyer_phone: match.buyer_phone,
            seller_phone: listing.seller_phone,
            distance_km: match.distance_km,
            match_score: match.match_score,
            status: "suggested",
          });
        }

        recordMetric("marketplace.matches.created", matches.length);
      }
    } catch (error) {
      logStructuredEvent(
        "MARKETPLACE_NOTIFY_BUYERS_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          listingId,
          correlationId: this.correlationId,
        },
        "error",
      );
    }
  }

  /**
   * Update conversation state in database
   */
  private async updateConversationState(
    phone: string,
    state: {
      flowType?: string | null;
      flowStep?: string | null;
      collectedData?: Record<string, unknown>;
      conversationHistory?: Array<{ role: string; content: string }>;
      lastAIResponse?: string;
      currentListingId?: string | null;
      currentIntentId?: string | null;
    },
  ): Promise<void> {
    try {
      await this.supabase.from("marketplace_conversations").upsert(
        {
          phone,
          flow_type: state.flowType,
          flow_step: state.flowStep,
          collected_data: state.collectedData || {},
          conversation_history: state.conversationHistory || [],
          last_ai_response: state.lastAIResponse,
          current_listing_id: state.currentListingId,
          current_intent_id: state.currentIntentId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "phone",
        },
      );
    } catch (error) {
      logStructuredEvent(
        "MARKETPLACE_SAVE_STATE_ERROR",
        {
          error: error instanceof Error ? error.message : String(error),
          correlationId: this.correlationId,
        },
        "error",
      );
    }
  }

  /**
   * Filter out null values from an object
   */
  private filterNullValues(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
    );
  }

  /**
   * Load conversation state from database
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
          collectedData: data.collected_data || {},
          conversationHistory: data.conversation_history || [],
          currentListingId: data.current_listing_id,
          currentIntentId: data.current_intent_id,
        };
      }
    } catch {
      // No existing conversation - that's OK
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
   * Reset conversation state
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
        last_ai_response: null,
        current_listing_id: null,
        current_intent_id: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "phone",
      },
    );
  }
}
