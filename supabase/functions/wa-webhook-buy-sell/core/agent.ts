/**
 * Buy & Sell Agent - Deno Implementation
 * 
 * This is the Deno-specific implementation optimized for Supabase Edge Functions.
 * It provides enhanced features for WhatsApp webhook handling including:
 * - Category selection workflows
 * - Vendor outreach system
 * - Pagination support
 * - Proactive business matching
 * - Intent classification (selling, buying, inquiry)
 * - Entity extraction (product, price, location, attributes)
 * - Conversation state management
 * - Proximity-based matching
 * 
 * For Node.js environments, use: packages/agents/src/agents/commerce/buy-and-sell.agent.ts
 * For API endpoints, use: supabase/functions/_shared/agents/buy-and-sell.ts (delegates here)
 * 
 * Natural language AI agent for connecting buyers and sellers in Rwanda.
 * Uses Gemini (via DualAIProvider) for intent recognition, entity extraction, and conversational flow.
 * 
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
// TODO Phase 2: Fix DualAIProvider import - path broken
// import { DualAIProvider } from "../../wa-agent-waiter/core/providers/dual-ai-provider.ts";
type DualAIProvider = any; // Temporary workaround  
import { AgentConfigLoader } from "../../_shared/agent-config-loader.ts";

// Types moved from deleted _shared/agents/buy-and-sell.ts
export interface MarketplaceContext {
  phone: string;
  flowType?: "selling" | "buying" | "inquiry" | "category_selection" | "awaiting_location" | "show_results" | "vendor_outreach" | null;
  flowStep?: string | null;
  collectedData?: Record<string, unknown>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  location?: { lat: number; lng: number };
  currentListingId?: string | null;
  currentIntentId?: string | null;
  selectedCategory?: string;
  searchResults?: Array<Record<string, unknown>>;
  pendingVendorOutreach?: {
    businessIds: string[];
    requestSummary: string;
    requestType: "product" | "service" | "medicine";
    awaitingConsent: boolean;
  };
  currentInquiryId?: string | null;
}

// Re-export for compatibility
export type BuyAndSellContext = MarketplaceContext;

// Business categories (moved from deleted wrapper)
export const BUSINESS_CATEGORIES = [
  { code: "pharmacy", name: "Pharmacies", icon: "💊", description: "Pharmacies and medical supplies" },
  { code: "salon", name: "Salons & Barbers", icon: "💇", description: "Hair salons, barber shops, beauty services" },
  { code: "restaurant", name: "Restaurants", icon: "🍽️", description: "Restaurants, cafes, and food services" },
  { code: "supermarket", name: "Supermarkets", icon: "🛒", description: "Supermarkets and grocery stores" },
  { code: "hardware", name: "Hardware Stores", icon: "🔧", description: "Hardware stores and construction supplies" },
  { code: "bank", name: "Banks & Finance", icon: "🏦", description: "Banks, microfinance, and mobile money" },
  { code: "hospital", name: "Hospitals & Clinics", icon: "🏥", description: "Hospitals, clinics, and health centers" },
  { code: "hotel", name: "Hotels & Lodging", icon: "🏨", description: "Hotels, guesthouses, and accommodations" },
  { code: "transport", name: "Transport & Logistics", icon: "🚗", description: "Transport services, taxis, and delivery" },
] as const;

// =====================================================
// CONFIGURATION
// =====================================================

const AI_TEMPERATURE = parseFloat(Deno.env.get("MARKETPLACE_AI_TEMPERATURE") || "0.7");
const AI_MAX_TOKENS = parseInt(Deno.env.get("MARKETPLACE_AI_MAX_TOKENS") || "1024", 10);

// Welcome message for new/first-time users - Kwizera persona
export const WELCOME_MESSAGE = `👋 Muraho! I'm Kwizera, your easyMO sourcing assistant.

I help you find products and services in Rwanda:
🔍 Source hard-to-find items (spare parts, medicine, electronics)
🏪 Connect you with verified local vendors
📞 Contact businesses on your behalf to check availability

Just tell me what you need! For example:
• "I need brake pads for a 2010 RAV4"
• "Find a pharmacy with Augmentin 625mg near Remera"
• "Looking for a plumber in Kigali"

You can also send me a voice note - I understand Kinyarwanda, English, French, and Swahili.

What can I help you find today?`;

// =====================================================
// BUSINESS CATEGORIES (Re-exported from shared module)
// =====================================================

export { BUSINESS_CATEGORIES };

export const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"] as const;

// =====================================================
// TYPES
// =====================================================

// MarketplaceContext is now in types.ts and re-exported above

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
    | "continue"
    | "contact_vendors"
    | "show_shortlist";
  data?: Record<string, unknown>;
  nextStep?: string;
  flowComplete?: boolean;
  vendorOutreach?: {
    shouldOffer: boolean;
    businessCount: number;
    awaitingConsent: boolean;
    inquiryId?: string;
  };
}

interface AIResponse {
  response_text: string;
  intent: "selling" | "buying" | "inquiry" | "vendor_outreach" | "unclear";
  extracted_entities: {
    product_name?: string | null;
    description?: string | null;
    price?: number | null;
    budget?: number | null;
    quantity?: number | null;
    location_text?: string | null;
    business_type?: string | null;
    timeframe?: string | null;
    brand?: string | null;
    tags?: string[];
    attributes?: Record<string, unknown>;
  };
  next_action: string;
  vendor_outreach?: {
    should_offer?: boolean;
    business_count?: number;
    awaiting_consent?: boolean;
  };
  flow_complete: boolean;
  is_medical?: boolean;
}

// =====================================================
// SYSTEM PROMPT - KWIZERA PERSONA
// =====================================================

/**
 * Kwizera AI Agent Persona
 * 
 * Named after the Kinyarwanda word meaning "Hope" or "Belief"
 * Archetype: The "Local Fixer" / The Knowledgeable Broker
 * 
 * Core traits:
 * - Spirit: Embodies "Ubuntu" (I am because we are) — helpful, communal, respectful
 * - Knowledge: Local expertise - distinguishes "duka" (kiosk), supermarket, open-air market
 * - Tone: Professional but warm. Concise (optimized for WhatsApp). Action-oriented.
 * - Languages: Fluent in English, French, Swahili, and Kinyarwanda
 * - Prime Directive: Never hallucinate availability. If unsure, ask the vendor or tell user to call.
 */
const SYSTEM_PROMPT = `You are KWIZERA, easyMO's AI sourcing assistant for Sub-Saharan Africa.

PERSONA:
- Name: Kwizera (meaning "Hope" in Kinyarwanda)
- Spirit: Embodies "Ubuntu" - helpful, communal, respectful
- Knowledge: Expert in local African markets - knows the difference between a "duka" (kiosk), supermarket, and open-air market. Understands "bodaboda" means motorbike taxi.
- Languages: Fluent in English, French, Swahili, and Kinyarwanda. Adapt instantly to the user's language.
- Tone: Professional but warm. Concise (WhatsApp-optimized). Action-oriented.

PRIME DIRECTIVE:
NEVER hallucinate product availability. If unsure, say you'll check with vendors or ask the user to call.

SERVICES YOU PROVIDE:
1. Product Sourcing: Finding hard-to-find items (spare parts, pharmaceuticals, electronics, construction materials)
2. Service Discovery: Locating plumbers, mechanics, cleaners, transport
3. Availability Checks: Automatically messaging vendors to ask "Do you have this in stock right now?"
4. Geo-Fenced Search: Strictly operate in supported regions (Rwanda). Politely block requests from Kenya, Nigeria, Uganda, South Africa.

WORKFLOW - THE CLIENT (BUYER) JOURNEY:

1. UNDERSTAND THE REQUEST
- Transcribe voice notes if audio
- Extract intent: Item, Car model (if auto parts), Location
- Check geo-restrictions (block UG, KE, NG, ZA)

2. HYBRID SOURCING
- Step 1: Check internal database for "Verified Partners" (onboarded vendors)
- Step 2: Use Google Maps grounding to find public mechanic shops/spare parts nearby
- ALWAYS separate results into "Verified Partners" (who we can message) and "Public Listings" (user contacts directly)

3. PRESENTATION & ACTION
Example response:
"I found 3 verified partners and 5 public shops.
Shall I message the partners to check stock for you?"

4. RESOLUTION (after user says yes)
- Broadcast to partners
- Wait for responses
- Notify user: "Shop A has it for 15,000 RWF. Here is their WhatsApp link."

CORE RULES:

1. NEVER contact businesses without explicit user consent
Example:
"I found 6 nearby electronics shops. Should I message them to check if they have a school laptop under 400k? Reply YES to proceed."

2. TYPO CORRECTION
Fix phonetic errors from voice transcripts:
- "Raph 4" → "RAV4"
- "Momo" → "Mobile Money"

3. MEDICAL SAFETY
For pharmacy/medicine requests:
- ONLY do logistics: extract drug name, strength, quantity
- NEVER give medical advice or suggest doses
- Always add: "Please follow your doctor's prescription and pharmacist's guidance."

4. GEO-BLOCKING
If location detected as Kenya, Nigeria, Uganda, or South Africa:
Reply: "I'm sorry, easyMO's sourcing service is not yet available in your region. We currently serve Rwanda. Stay tuned for expansion!"

5. CATEGORY SEPARATION (CRITICAL)
ALWAYS separate results into:
- "Verified Partners" (who we can message on your behalf)
- "Public Listings" (who you must contact directly)
Never claim you can message a Google Maps result unless they're also in our database.

6. SAFETY
Do NOT source illegal items, weapons, or illicit drugs. Politely refuse.

TONE GUIDELINES:
- User-facing: Friendly, practical, concise. One question at a time. Simple language. Use emojis sparingly.
- Vendor-facing: Professional, respectful, efficient. Short messages.

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message to the user",
  "intent": "buying|selling|inquiry|vendor_outreach|unclear",
  "extracted_entities": {
    "product_name": "string or null",
    "description": "string or null",
    "price": "number or null",
    "budget": "number or null",
    "quantity": "number or null",
    "location_text": "string or null",
    "business_type": "string or null",
    "timeframe": "string or null (now|today|any)",
    "brand": "string or null",
    "tags": ["array", "of", "tags"],
    "attributes": {}
  },
  "next_action": "ask_location|ask_details|search_businesses|confirm_vendor_outreach|contact_vendors|show_shortlist|create_listing|clarify|continue",
  "vendor_outreach": {
    "should_offer": true/false,
    "business_count": number,
    "awaiting_consent": true/false
  },
  "flow_complete": false,
  "is_medical": false
}`;

function buildPromptFromConfig(config: Awaited<ReturnType<AgentConfigLoader["loadAgentConfig"]>>): string {
  const parts: string[] = [];

  if (config.persona) {
    parts.push(`Role: ${config.persona.role_name}`);
    parts.push(`Tone: ${config.persona.tone_style}`);
    if (config.persona.languages?.length) {
      parts.push(`Languages: ${config.persona.languages.join(", ")}`);
    }
    parts.push("");
  }

  if (config.systemInstructions?.instructions) {
    parts.push(config.systemInstructions.instructions);
  }

  if (config.systemInstructions?.guardrails) {
    parts.push("");
    parts.push("GUARDRAILS:");
    parts.push(config.systemInstructions.guardrails);
  }

  if (config.tools.length > 0) {
    parts.push("");
    parts.push("AVAILABLE TOOLS:");
    for (const tool of config.tools) {
      parts.push(`- ${tool.name}: ${tool.description}`);
    }
  }

  if (parts.length === 0) return SYSTEM_PROMPT;
  return parts.join("\n");
}

// =====================================================
// INTERACTIVE WORKFLOW HELPERS
// =====================================================

/**
 * Generate the category selection menu with emoji-numbered options
 */
export function generateCategoryMenu(): string {
  let menu = "🛍️ *EasyMO Buy & Sell*\n\n";
  menu += "What are you looking for? Choose a category:\n\n";
  
  BUSINESS_CATEGORIES.forEach((cat, i) => {
    menu += `${EMOJI_NUMBERS[i]} ${cat.icon} ${cat.name}\n`;
  });
  
  menu += "\n📍 _Reply with a number (1-9) or describe what you need_";
  return menu;
}

/**
 * Parse user input to get selected category number
 * Supports: "1", "1️⃣", "one", "pharmacy", etc.
 */
export function parseCategorySelection(input: string): number | null {
  const normalized = input.trim().toLowerCase();
  
  // Direct number match (1-9)
  const numMatch = normalized.match(/^(\d)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 9) return num;
  }
  
  // Emoji number match (emojis don't have lowercase, so just check includes)
  const emojiIndex = EMOJI_NUMBERS.findIndex(e => input.includes(e));
  if (emojiIndex >= 0) return emojiIndex + 1;
  
  // Word number match
  const wordNumbers: Record<string, number> = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
    "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9,
  };
  for (const [word, num] of Object.entries(wordNumbers)) {
    if (normalized.includes(word)) return num;
  }
  
  // Category name/code match
  for (let i = 0; i < BUSINESS_CATEGORIES.length; i++) {
    const cat = BUSINESS_CATEGORIES[i];
    if (
      normalized.includes(cat.code.toLowerCase()) ||
      normalized.includes(cat.name.toLowerCase()) ||
      cat.description.toLowerCase().split(" ").some(w => normalized.includes(w) && w.length > 3)
    ) {
      return i + 1;
    }
  }
  
  return null;
}

/**
 * Get category by number (1-indexed)
 */
export function getCategoryByNumber(num: number): typeof BUSINESS_CATEGORIES[number] | null {
  if (num < 1 || num > BUSINESS_CATEGORIES.length) return null;
  return BUSINESS_CATEGORIES[num - 1];
}

/**
 * Generate location request message
 */
export function generateLocationRequest(category: typeof BUSINESS_CATEGORIES[number]): string {
  return (
    `📍 *Share Your Location*\n\n` +
    `Looking for ${category.icon} ${category.name} near you!\n\n` +
    `Please share your location:\n` +
    `• Tap the 📎 attachment icon\n` +
    `• Select 📍 Location\n` +
    `• Choose "Send your current location"\n\n` +
    `_Or type a location like "Kigali" or "Nyarugenge"_`
  );
}

/**
 * Format search results as emoji-numbered list
 */
export function formatBusinessResults(
  businesses: Array<{
    id?: string;
    name: string;
    category?: string;
    city?: string;
    address?: string;
    phone?: string;
    rating?: number;
    distance_km?: number;
  }>,
  category: typeof BUSINESS_CATEGORIES[number],
): string {
  if (!businesses || businesses.length === 0) {
    return (
      `😔 *No ${category.name} Found Nearby*\n\n` +
      `We couldn't find any ${category.name.toLowerCase()} in your area.\n\n` +
      `Try:\n` +
      `• Sharing a different location\n` +
      `• Type *menu* to browse other categories`
    );
  }

  let response = `${category.icon} *${category.name} Near You*\n\n`;
  
  const limit = Math.min(businesses.length, 9);
  for (let i = 0; i < limit; i++) {
    const biz = businesses[i];
    const stars = biz.rating ? "⭐".repeat(Math.min(Math.round(biz.rating), 5)) : "";
    const distance = biz.distance_km != null ? ` (${biz.distance_km.toFixed(1)}km)` : "";
    
    response += `${EMOJI_NUMBERS[i]} *${biz.name}*${distance}\n`;
    if (biz.city || biz.address) {
      response += `   📍 ${biz.city || biz.address}\n`;
    }
    if (stars) {
      response += `   ${stars}\n`;
    }
    response += `\n`;
  }
  
  response += `📞 _Reply with a number (1-${limit}) to get contact info_\n`;
  response += `🔄 _Type *menu* to see more categories_`;
  
  return response;
}

/**
 * Format single business details for contact
 */
export function formatBusinessContact(business: {
  name: string;
  category?: string;
  city?: string;
  address?: string;
  phone?: string;
  rating?: number;
  distance_km?: number;
  description?: string;
}): string {
  let response = `🏪 *${business.name}*\n\n`;
  
  if (business.category) {
    response += `📂 ${business.category}\n`;
  }
  if (business.address || business.city) {
    response += `📍 ${business.address || business.city}\n`;
  }
  if (business.distance_km != null) {
    response += `🚶 ${business.distance_km.toFixed(1)}km away\n`;
  }
  if (business.rating) {
    response += `⭐ ${business.rating.toFixed(1)} rating\n`;
  }
  if (business.description) {
    response += `\n${business.description}\n`;
  }
  
  // Minimum phone length to mask middle digits for privacy
  const MIN_PHONE_LENGTH_FOR_MASKING = 8;
  
  if (business.phone) {
    // Mask middle digits for privacy in display
    const phoneDisplay = business.phone.length > MIN_PHONE_LENGTH_FOR_MASKING 
      ? `${business.phone.slice(0, 4)}****${business.phone.slice(-3)}`
      : business.phone;
    response += `\n📞 Contact: ${phoneDisplay}\n`;
    response += `\n_Reply *call* to get the full phone number_`;
  } else {
    response += `\n_Contact information not available_`;
  }
  
  response += `\n\n🔄 _Type *menu* to search for more businesses_`;
  
  return response;
}

/**
 * Parse result selection (1-9) from user input
 */
export function parseResultSelection(input: string): number | null {
  return parseCategorySelection(input); // Same logic as category selection
}

// =====================================================
// MARKETPLACE AGENT CLASS
// =====================================================

export class MarketplaceAgent {
  private aiProvider: DualAIProvider | null;
  private supabase: SupabaseClient;
  private correlationId?: string;
  private configLoader: AgentConfigLoader;

  constructor(
    supabase: SupabaseClient,
    correlationId?: string,
  ) {
    this.supabase = supabase;
    this.correlationId = correlationId;
    this.configLoader = new AgentConfigLoader(supabase);

    try {
      // TODO Phase 2: Fix DualAIProvider instantiation (path broken)
      // this.aiProvider = new DualAIProvider();
      this.aiProvider = null; // Temporarily disabled
      if (this.aiProvider === null) {
        logStructuredEvent(
          "MARKETPLACE_AGENT_PROVIDER_DISABLED",
          { reason: "DualAIProvider path broken", correlationId },
          "warn",
        );
      }
    } catch (error) {
      this.aiProvider = null;
      logStructuredEvent(
        "MARKETPLACE_AGENT_PROVIDER_MISSING",
        {
          error: error instanceof Error ? error.message : String(error),
          correlationId,
        },
        "warn",
      );
    }
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

      // Fallback if no AI configured - show welcome message
      if (!this.aiProvider) {
        logStructuredEvent(
          "MARKETPLACE_AGENT_NO_AI_PROVIDER",
          {
            phone: context.phone.slice(-4),
            correlationId: this.correlationId,
          },
          "warn",
        );
        
        return {
          message: WELCOME_MESSAGE,
          action: "continue",
          flowComplete: false,
        };
      }

      const systemPrompt = await this.getSystemPrompt();

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

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt + contextPrompt },
      ];

      if (context.conversationHistory?.length) {
        for (const entry of context.conversationHistory.slice(-8)) {
          messages.push({
            role: entry.role === "assistant" ? "assistant" : "user",
            content: entry.content,
          });
        }
      }

      messages.push({ role: "user", content: userMessage });

      const responseText = await this.aiProvider.chat(messages, {
        temperature: AI_TEMPERATURE,
        maxTokens: AI_MAX_TOKENS,
        metadata: { agent: "buy_sell" },
      });

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
  private async getSystemPrompt(): Promise<string> {
    try {
      const config = await this.configLoader.loadAgentConfig("buy_sell");
      return buildPromptFromConfig(config);
    } catch (error) {
      await logStructuredEvent(
        "MARKETPLACE_AGENT_PROMPT_FALLBACK",
        { error: error instanceof Error ? error.message : String(error), correlationId: this.correlationId },
        "warn",
      );
      return SYSTEM_PROMPT;
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

    // If user wants to connect with a seller/business
    if (action === "connect" || action === "confirm") {
      // If we have a current listing or business context, provide the contact info
      if (context.currentListingId || aiResponse.extracted_entities.phone) {
         // Logic to get phone number would go here if not already in context
         // For now, we rely on the AI's response text, but we can enhance it to send a Contact Card
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
      // Search unified business registry
      const { data: businesses } = await this.supabase.rpc(
        "search_businesses_nearby",
        {
          search_term: searchTerm,
          user_lat: location.lat,
          user_lng: location.lng,
          radius_km: 10,
          result_limit: 10,
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
        if (r.seller_phone) 
          formatted += `   💬 https://wa.me/${(r.seller_phone as string).replace('+', '')}?text=I'm%20interested%20in%20${encodeURIComponent(r.title as string)}\n`;
      } else {
        formatted += `${i + 1}. *${r.name}*${distance}${rating}\n`;
        formatted += `   📂 ${r.category} | 📍 ${r.city}\n`;
        if (r.phone) 
            formatted += `   💬 https://wa.me/${(r.phone as string).replace(/\D/g, '')}\n`;
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
