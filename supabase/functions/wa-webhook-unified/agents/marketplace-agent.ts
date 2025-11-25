/**
 * Marketplace Agent
 * 
 * Natural language AI agent for connecting buyers and sellers in Rwanda.
 * Migrated from wa-webhook-marketplace to unified architecture.
 * 
 * Features:
 * - Conversational selling flow (create listings)
 * - Conversational buying flow (search and match)
 * - Proximity-based matching
 * - Integration with business directory
 */

import { BaseAgent } from "./base-agent.ts";
import {
  AgentType,
  Tool,
  WhatsAppMessage,
  UnifiedSession,
  AgentResponse,
  AIResponse,
} from "../core/types.ts";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";

export class MarketplaceAgent extends BaseAgent {
  get type(): AgentType {
    return "marketplace";
  }

  get keywords(): string[] {
    return [
      "buy", "sell", "product", "shop", "store", "purchase", "selling", "buying",
      "market", "item", "goods", "trade", "merchant", "business", "service"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Marketplace Agent, a helpful assistant that connects buyers and sellers in Rwanda via WhatsApp.

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
- If user says something unclear, ask for clarification
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
  "flow_complete": false,
  "handoff_to": null
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "create_listing",
        description: "Create a new marketplace listing",
        parameters: {
          type: "object",
          properties: {
            product_name: { type: "string", description: "Product or service name" },
            description: { type: "string", description: "Product description" },
            price: { type: "number", description: "Price in RWF" },
            location_text: { type: "string", description: "Location description" },
          },
          required: ["product_name"],
        },
      },
      {
        name: "search_listings",
        description: "Search for marketplace listings and businesses",
        parameters: {
          type: "object",
          properties: {
            search_term: { type: "string", description: "What to search for" },
            radius_km: { type: "number", description: "Search radius in km" },
          },
          required: ["search_term"],
        },
      },
      {
        name: "notify_matches",
        description: "Notify matching buyers about a new listing",
        parameters: {
          type: "object",
          properties: {
            listing_id: { type: "string", description: "Listing ID" },
          },
          required: ["listing_id"],
        },
      },
    ];
  }

  /**
   * Override process to handle marketplace-specific logic
   */
  async process(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    const textLower = message.body.toLowerCase();

    // Handle reset commands
    if (textLower === "reset" || textLower === "start over" || textLower === "clear") {
      session.collectedData = {};
      session.activeFlow = undefined;
      session.flowStep = undefined;
      return {
        text: "🔄 Let's start fresh!\n\n" +
          "I'm your EasyMO Marketplace assistant. I can help you:\n" +
          "• *Sell* something (just tell me what you want to sell)\n" +
          "• *Find* products, services, or businesses\n" +
          "• *Connect* with buyers and sellers near you\n\n" +
          "What would you like to do?"
      };
    }

    // Handle welcome/menu commands
    if (
      !message.body ||
      textLower === "marketplace" ||
      textLower === "menu" ||
      textLower === "home" ||
      textLower === "help"
    ) {
      session.collectedData = {};
      session.activeFlow = undefined;
      session.flowStep = undefined;
      return {
        text: "🛍️ *EasyMO Marketplace*\n\n" +
          "Welcome! I'm your AI assistant for buying and selling in Rwanda.\n\n" +
          "You can:\n" +
          "• Say what you want to *sell* (e.g., \"I want to sell my dining table\")\n" +
          "• Say what you're *looking for* (e.g., \"Looking for a pharmacy nearby\")\n" +
          "• Ask about *businesses* (e.g., \"Where can I find a plumber?\")\n\n" +
          "Just tell me what you need in your own words!"
      };
    }

    // Extract location if provided
    if (message.location) {
      session.location = {
        lat: message.location.latitude,
        lng: message.location.longitude,
      };
      session.collectedData.lat = message.location.latitude;
      session.collectedData.lng = message.location.longitude;
    }

    // Process with AI
    return super.process(message, session);
  }

  /**
   * Execute tool calls
   */
  protected async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    session: UnifiedSession
  ): Promise<any> {
    const startTime = Date.now();

    try {
      switch (toolName) {
        case "create_listing":
          return await this.createListing(session.userPhone, parameters);

        case "search_listings":
          return await this.searchListings(
            parameters.search_term,
            session.location,
            parameters.radius_km || 10
          );

        case "notify_matches":
          return await this.notifyMatchingBuyers(parameters.listing_id);

        default:
          console.warn(`Unknown tool: ${toolName}`);
          return null;
      }
    } finally {
      const duration = Date.now() - startTime;
      recordMetric("marketplace.tool.execution", 1, {
        tool: toolName,
        duration_ms: duration,
      });
    }
  }

  /**
   * Create a new marketplace listing
   */
  private async createListing(
    sellerPhone: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; listingId?: string; error?: string }> {
    try {
      const title = data.product_name || data.title || "Untitled Listing";

      const { data: listing, error } = await this.supabase
        .from("unified_listings")
        .insert({
          owner_phone: sellerPhone,
          domain: "marketplace",
          listing_type: "product",
          title,
          description: data.description || null,
          price: data.price || null,
          currency: "RWF",
          location_text: data.location_text || null,
          lat: data.lat || null,
          lng: data.lng || null,
          attributes: data.attributes || {},
          status: "active",
          source_agent: "marketplace",
        })
        .select("id")
        .single();

      if (error) {
        await logStructuredEvent("MARKETPLACE_CREATE_LISTING_ERROR", {
          error: error.message,
          correlationId: this.correlationId,
        }, "error");
        return { success: false, error: error.message };
      }

      await logStructuredEvent("MARKETPLACE_LISTING_CREATED", {
        listingId: listing.id,
        productName: data.product_name,
        correlationId: this.correlationId,
      });

      recordMetric("marketplace.listing.created", 1);

      // Notify matching buyers
      await this.notifyMatchingBuyers(listing.id);

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
  private async searchListings(
    searchTerm: string,
    location?: { lat: number; lng: number },
    radiusKm: number = 10
  ): Promise<Array<Record<string, any>>> {
    const results: Array<Record<string, any>> = [];

    try {
      if (!location) {
        // Search without location
        const { data: listings } = await this.supabase
          .from("unified_listings")
          .select("*")
          .eq("domain", "marketplace")
          .eq("status", "active")
          .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
          .limit(5);

        if (listings) {
          results.push(...listings.map(l => ({ ...l, source: "listing" })));
        }
      } else {
        // Search with proximity
        const { data: listings } = await this.supabase.rpc(
          "search_marketplace_listings_nearby",
          {
            search_term: searchTerm,
            user_lat: location.lat,
            user_lng: location.lng,
            radius_km: radiusKm,
            result_limit: 5,
          }
        );

        if (listings) {
          results.push(...listings.map((l: any) => ({ ...l, source: "listing" })));
        }

        // Also search business directory
        const { data: businesses } = await this.supabase.rpc(
          "search_businesses_nearby",
          {
            search_term: searchTerm,
            user_lat: location.lat,
            user_lng: location.lng,
            radius_km: radiusKm,
            result_limit: 5,
          }
        );

        if (businesses) {
          results.push(...businesses.map((b: any) => ({ ...b, source: "business" })));
        }
      }
    } catch (error) {
      await logStructuredEvent("MARKETPLACE_SEARCH_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
        correlationId: this.correlationId,
      }, "error");
    }

    // Sort by distance if available
    return results.sort(
      (a, b) => ((a.distance_km as number) || 999) - ((b.distance_km as number) || 999)
    );
  }

  /**
   * Notify matching buyers when a new listing is created
   */
  private async notifyMatchingBuyers(listingId: string): Promise<void> {
    try {
      const { data: listing } = await this.supabase
        .from("unified_listings")
        .select("owner_phone")
        .eq("id", listingId)
        .single();

      if (!listing) {
        await logStructuredEvent("MARKETPLACE_NOTIFY_BUYERS_LISTING_NOT_FOUND", {
          listingId,
          correlationId: this.correlationId,
        }, "warn");
        return;
      }

      const { data: matches } = await this.supabase.rpc(
        "find_matching_marketplace_buyers",
        { p_listing_id: listingId }
      );

      if (matches && matches.length > 0) {
        await logStructuredEvent("MARKETPLACE_MATCHES_FOUND", {
          listingId,
          matchCount: matches.length,
          correlationId: this.correlationId,
        });

        // Create match records
        for (const match of matches) {
          await this.supabase.from("unified_matches").insert({
            listing_id: listingId,
            seeker_phone: match.buyer_phone,
            owner_phone: listing.owner_phone,
            domain: "marketplace",
            distance_km: match.distance_km,
            match_score: match.match_score,
            status: "suggested",
          });
        }

        recordMetric("marketplace.matches.created", matches.length);
      }
    } catch (error) {
      await logStructuredEvent("MARKETPLACE_NOTIFY_BUYERS_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        listingId,
        correlationId: this.correlationId,
      }, "error");
    }
  }

  /**
   * Format search results for display
   */
  private formatSearchResults(results: Array<Record<string, any>>): string {
    if (results.length === 0) return "";

    let formatted = "🔍 *Found nearby:*\n\n";

    results.slice(0, 5).forEach((r, i) => {
      const distance = r.distance_km ? ` (${Number(r.distance_km).toFixed(1)}km)` : "";
      const price = r.price ? ` - ${r.price} ${r.currency || "RWF"}` : "";
      const rating = r.rating ? ` ⭐${r.rating}` : "";

      if (r.source === "listing") {
        formatted += `${i + 1}. *${r.title}*${distance}${price}\n`;
        if (r.description) formatted += `   ${r.description.slice(0, 50)}...\n`;
      } else {
        formatted += `${i + 1}. *${r.name}*${distance}${rating}\n`;
        formatted += `   📂 ${r.category} | 📍 ${r.city}\n`;
        if (r.phone) formatted += `   📞 ${r.phone}\n`;
      }
      formatted += "\n";
    });

    formatted += "Reply with a number to get contact details, or describe what else you're looking for.";

    return formatted;
  }
}
