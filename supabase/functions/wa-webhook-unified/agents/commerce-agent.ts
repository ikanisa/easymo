/**
 * Unified Commerce Agent
 * 
 * World-class commerce agent that combines:
 * - Marketplace (buy/sell products)
 * - Business Directory (find businesses/services)
 * - Business Broker (partnerships/investments)
 * 
 * Features:
 * - Natural language conversational flows
 * - Location-based proximity matching
 * - Payment integration (MoMo USSD)
 * - Photo uploads
 * - Google Places API integration
 * - Rating & review system
 * - Content moderation
 * - Escrow for high-value transactions
 */

import { BaseAgent } from "./base-agent.ts";
import {
  AgentType,
  Tool,
  WhatsAppMessage,
  UnifiedSession,
  AgentResponse,
} from "../core/types.ts";
import { logStructuredEvent, recordMetric } from "../../_shared/observability.ts";
import { resolveUnifiedLocation } from "../core/location-handler.ts";

// =====================================================
// CONSTANTS & CATEGORIES
// =====================================================

const PRODUCT_CATEGORIES = [
  "electronics", "furniture", "clothing", "food", "vehicles", 
  "household", "tools", "books", "sports", "other"
];

const BUSINESS_CATEGORIES = [
  "pharmacy", "restaurant", "hotel", "shop", "garage", 
  "salon", "clinic", "school", "bank", "other"
];

const SERVICE_CATEGORIES = [
  "plumbing", "electrical", "construction", "cleaning", 
  "repair", "delivery", "tutoring", "consulting", "other"
];

// =====================================================
// UNIFIED COMMERCE AGENT
// =====================================================

export class CommerceAgent extends BaseAgent {
  get type(): AgentType {
    return "marketplace"; // Keep as marketplace for backward compatibility
  }

  get keywords(): string[] {
    return [
      // Marketplace
      "buy", "sell", "product", "shop", "store", "purchase", "selling", "buying",
      "market", "item", "goods", "trade", "price", "cost",
      // Business Directory
      "business", "company", "service", "find", "nearby", "directory",
      "pharmacy", "restaurant", "hotel", "salon", "clinic", "garage",
      // Services
      "plumber", "electrician", "repair", "fix", "help", "need",
      // Broker
      "invest", "partner", "opportunity", "startup", "venture", "franchise"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO's Unified Commerce Agent - the all-in-one AI assistant for commerce in Rwanda.

YOUR CAPABILITIES:

1️⃣ **MARKETPLACE** - Buy & Sell Products/Services
   - Help users SELL: Create listings for products/services
   - Help users BUY: Search and match with sellers
   - Connect buyers with sellers based on proximity
   - Handle payment flow (MoMo USSD)

2️⃣ **BUSINESS DIRECTORY** - Find Businesses & Services
   - Search businesses by category, name, location
   - Find nearby pharmacies, restaurants, salons, etc.
   - Get business details (phone, address, hours, ratings)
   - Save favorites for quick access
   - Provide Google Maps directions

3️⃣ **BUSINESS BROKER** - Partnerships & Opportunities
   - Connect entrepreneurs with investors
   - Find business partners (suppliers, distributors, franchises)
   - Match complementary businesses
   - Facilitate business networking

SELLING FLOW (Marketplace):
When a user wants to sell something:
- Extract: product_name, description, price, location
- Ask for photos if not provided
- Confirm all details before creating listing
- Notify matching buyers automatically
- Guide through payment process if buyer found

BUYING FLOW (Marketplace):
When a user is looking to buy:
- Understand what they need
- Search BOTH marketplace listings AND business directory
- Show nearby options with distance
- Offer to connect with seller/business
- Facilitate payment if transaction proceeds

BUSINESS SEARCH FLOW:
When user needs a service or business:
- Identify category (pharmacy, restaurant, plumber, etc.)
- Get user location for proximity search
- Search database + Google Places API
- Show 3-5 top results with ratings, distance
- Provide contact info and directions

PARTNERSHIP FLOW:
When user seeks business opportunities:
- Understand type: investor, partner, supplier, franchise
- Match based on industry and location
- Connect compatible parties
- Protect confidential information

RESPONSE FORMAT (CRITICAL):
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣)
- Format: "1️⃣ Name - Price/Category\\n   📍 Location | 📞 Contact | 🌟 Rating"
- Keep responses concise (max 4-5 sentences + list)
- Use relevant emojis: 🛒 🏪 💼 📱 🚗 🏠 💰 📞 📍 ⭐
- End with clear call-to-action

HYBRID SEARCH STRATEGY:
For searches, ALWAYS check:
1. Marketplace listings (for products/services for sale)
2. Business directory (for established businesses)
3. Google Places API (for real-time business data)
Merge and rank by relevance + proximity

RULES:
- Be conversational and friendly
- Use simple Kinyarwanda-influenced English when helpful
- Always confirm before creating listings
- Prices are in RWF (Rwandan Francs) by default
- Location is CRITICAL for matching
- Protect user privacy (don't share contacts without permission)
- Flag suspicious listings for moderation
- Suggest escrow for transactions over 500,000 RWF

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message to the user",
  "intent": "selling|buying|find_business|find_service|partnership|inquiry|unclear",
  "extracted_entities": {
    "product_name": "string or null",
    "description": "string or null",
    "price": "number or null",
    "location_text": "string or null",
    "business_type": "string or null",
    "category": "string or null",
    "search_query": "string or null"
  },
  "next_action": "ask_price|ask_location|create_listing|search_hybrid|connect|payment|clarify",
  "flow_complete": false,
  "confidence": "high|medium|low"
}`;
  }

  get tools(): Tool[] {
    return [
      // ============================================
      // MARKETPLACE TOOLS (3)
      // ============================================
      {
        name: "create_listing",
        description: "Create a new marketplace listing for a product or service",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Product/service title" },
            category: { 
              type: "string", 
              description: "Product category",
              enum: PRODUCT_CATEGORIES 
            },
            price: { type: "number", description: "Price in RWF" },
            description: { type: "string", description: "Detailed description" },
            location_text: { type: "string", description: "Location description" },
            photos: { 
              type: "array", 
              items: { type: "string" },
              description: "Array of photo URLs"
            },
          },
          required: ["title", "category"],
        },
      },
      {
        name: "search_marketplace",
        description: "Search marketplace listings for products/services",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What to search for" },
            category: { type: "string", description: "Product category" },
            max_price: { type: "number", description: "Maximum price filter" },
            radius_km: { type: "number", description: "Search radius", default: 10 },
          },
          required: ["query"],
        },
      },
      {
        name: "initiate_purchase",
        description: "Start the purchase flow for a listing",
        parameters: {
          type: "object",
          properties: {
            listing_id: { type: "string", description: "Listing ID" },
            offered_price: { type: "number", description: "Buyer's offered price (optional)" },
            escrow_requested: { type: "boolean", description: "Request escrow (for high value)" },
          },
          required: ["listing_id"],
        },
      },

      // ============================================
      // BUSINESS DIRECTORY TOOLS (6)
      // ============================================
      {
        name: "search_businesses",
        description: "Search business directory by category, name, or service type",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            category: { 
              type: "string", 
              description: "Business category",
              enum: BUSINESS_CATEGORIES 
            },
            city: { type: "string", description: "City filter" },
            min_rating: { type: "number", description: "Minimum rating (1-5)" },
            radius_km: { type: "number", description: "Search radius", default: 50 },
            limit: { type: "number", description: "Max results", default: 10 },
          },
          required: ["query"],
        },
      },
      {
        name: "get_business_details",
        description: "Get full details of a specific business",
        parameters: {
          type: "object",
          properties: {
            business_id: { type: "string", description: "Business ID" },
          },
          required: ["business_id"],
        },
      },
      {
        name: "find_nearby",
        description: "Find businesses or listings near user location using GPS",
        parameters: {
          type: "object",
          properties: {
            type: { 
              type: "string", 
              enum: ["business", "listing", "all"],
              description: "What to search for"
            },
            category: { type: "string", description: "Category filter" },
            radius_km: { type: "number", description: "Search radius", default: 5 },
          },
          required: ["type"],
        },
      },
      {
        name: "get_directions",
        description: "Get Google Maps directions to a business or seller",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: "string", description: "Business or listing ID" },
            target_type: { type: "string", enum: ["business", "listing"] },
          },
          required: ["target_id", "target_type"],
        },
      },
      {
        name: "save_favorite",
        description: "Save a business or listing to user favorites",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: "string", description: "Business or listing ID" },
            target_type: { type: "string", enum: ["business", "listing"] },
            notes: { type: "string", description: "Optional notes" },
          },
          required: ["target_id", "target_type"],
        },
      },
      {
        name: "register_business",
        description: "Register a new business in the directory",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Business name" },
            category: { 
              type: "string", 
              description: "Business category",
              enum: BUSINESS_CATEGORIES 
            },
            description: { type: "string", description: "Business description" },
            phone: { type: "string", description: "Contact phone" },
            city: { type: "string", description: "City" },
            address: { type: "string", description: "Street address" },
          },
          required: ["name", "category", "city"],
        },
      },

      // ============================================
      // BUSINESS BROKER TOOLS (2)
      // ============================================
      {
        name: "find_business_partners",
        description: "Find potential business partners or investors",
        parameters: {
          type: "object",
          properties: {
            industry: { type: "string", description: "Industry sector" },
            partnership_type: { 
              type: "string", 
              enum: ["investor", "supplier", "distributor", "franchise", "joint_venture"],
              description: "Type of partnership sought"
            },
            city: { type: "string", description: "Preferred location" },
          },
          required: ["industry", "partnership_type"],
        },
      },
      {
        name: "create_partnership_opportunity",
        description: "Create a business opportunity listing",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Opportunity title" },
            industry: { type: "string", description: "Industry sector" },
            type: { 
              type: "string", 
              enum: ["seeking_investment", "seeking_partner", "franchise_opportunity", "acquisition"],
              description: "Opportunity type"
            },
            description: { type: "string", description: "Detailed description" },
            investment_range: { type: "string", description: "e.g., '5M-10M RWF'" },
          },
          required: ["title", "industry", "type"],
        },
      },

      // ============================================
      // TRANSACTION & TRUST TOOLS (3)
      // ============================================
      {
        name: "rate_and_review",
        description: "Leave a rating and review for a business, seller, or transaction",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: "string", description: "Business/seller/transaction ID" },
            target_type: { 
              type: "string", 
              enum: ["business", "seller", "transaction"],
              description: "What is being reviewed"
            },
            rating: { 
              type: "number", 
              description: "Star rating (1-5)",
              minimum: 1,
              maximum: 5
            },
            review_text: { type: "string", description: "Review text" },
          },
          required: ["target_id", "target_type", "rating"],
        },
      },
      {
        name: "request_escrow",
        description: "Request escrow service for high-value transaction",
        parameters: {
          type: "object",
          properties: {
            transaction_id: { type: "string", description: "Transaction ID" },
            amount: { type: "number", description: "Amount to escrow in RWF" },
          },
          required: ["transaction_id", "amount"],
        },
      },
      {
        name: "report_issue",
        description: "Report a listing, business, or user for moderation",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: "string", description: "ID to report" },
            target_type: { type: "string", enum: ["listing", "business", "user"] },
            reason: { 
              type: "string", 
              enum: ["spam", "fraud", "inappropriate", "duplicate", "other"],
              description: "Reason for report"
            },
            details: { type: "string", description: "Additional details" },
          },
          required: ["target_id", "target_type", "reason"],
        },
      },

      // ============================================
      // UTILITY TOOLS (2)
      // ============================================
      {
        name: "search_hybrid",
        description: "Search across marketplace, business directory, and Google Places",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What to search for" },
            radius_km: { type: "number", description: "Search radius", default: 10 },
            include_google_places: { type: "boolean", description: "Include Google Places API", default: true },
          },
          required: ["query"],
        },
      },
      {
        name: "get_market_prices",
        description: "Get typical market prices for a product category",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", description: "Product category" },
            product_name: { type: "string", description: "Specific product (optional)" },
          },
          required: ["category"],
        },
      },
    ];
  }

  /**
   * Override process to handle commerce-specific logic
   */
  async process(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    const textLower = message.body.toLowerCase();

    // Handle reset commands
    if (["reset", "start over", "clear", "cancel"].includes(textLower)) {
      session.collectedData = {};
      session.activeFlow = undefined;
      session.flowStep = undefined;
      return this.getWelcomeMessage();
    }

    // Handle help/menu
    if (
      !message.body ||
      ["commerce", "marketplace", "business", "menu", "help"].includes(textLower)
    ) {
      return this.getWelcomeMessage();
    }

    // Resolve location (cache → saved → message → prompt)
    const locationResult = await resolveUnifiedLocation(
      this.supabase,
      message.from,
      message.location
    );

    if (locationResult.location) {
      session.location = {
        lat: locationResult.location.lat,
        lng: locationResult.location.lng,
      };
      session.collectedData.lat = locationResult.location.lat;
      session.collectedData.lng = locationResult.location.lng;

      await logStructuredEvent("COMMERCE_LOCATION_RESOLVED", {
        source: locationResult.location.source,
        from: message.from,
        correlationId: this.correlationId,
      });
    }

    // Process with AI
    return super.process(message, session);
  }

  /**
   * Get welcome message
   */
  private getWelcomeMessage(): AgentResponse {
    return {
      text:
        "🛍️ *EasyMO Commerce* - Your All-in-One Business Assistant\n\n" +
        "I can help you with:\n\n" +
        "🛒 *Marketplace*\n" +
        "• Sell products/services\n" +
        "• Find items to buy\n" +
        "• Connect with sellers\n\n" +
        "🏪 *Business Directory*\n" +
        "• Find nearby businesses\n" +
        "• Get contact & directions\n" +
        "• Save favorites\n\n" +
        "💼 *Business Opportunities*\n" +
        "• Find investors/partners\n" +
        "• List your business\n" +
        "• Networking\n\n" +
        "Just tell me what you need! Examples:\n" +
        '• "I want to sell my laptop"\n' +
        '• "Looking for a pharmacy nearby"\n' +
        '• "Find investors for my startup"',
    };
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
        // Marketplace tools
        case "create_listing":
          return await this.createListing(session.userPhone, parameters);
        case "search_marketplace":
          return await this.searchMarketplace(parameters, session.location);
        case "initiate_purchase":
          return await this.initiatePurchase(session.userPhone, parameters);

        // Business directory tools
        case "search_businesses":
          return await this.searchBusinesses(parameters, session.location);
        case "get_business_details":
          return await this.getBusinessDetails(parameters.business_id);
        case "find_nearby":
          return await this.findNearby(parameters, session);
        case "get_directions":
          return await this.getDirections(parameters, session);
        case "save_favorite":
          return await this.saveFavorite(session.userPhone, parameters);
        case "register_business":
          return await this.registerBusiness(session.userPhone, parameters);

        // Business broker tools
        case "find_business_partners":
          return await this.findBusinessPartners(parameters, session.location);
        case "create_partnership_opportunity":
          return await this.createPartnershipOpportunity(session.userPhone, parameters);

        // Transaction & trust tools
        case "rate_and_review":
          return await this.rateAndReview(session.userPhone, parameters);
        case "request_escrow":
          return await this.requestEscrow(parameters);
        case "report_issue":
          return await this.reportIssue(session.userPhone, parameters);

        // Utility tools
        case "search_hybrid":
          return await this.searchHybrid(parameters, session);
        case "get_market_prices":
          return await this.getMarketPrices(parameters);

        default:
          console.warn(`Unknown tool: ${toolName}`);
          return null;
      }
    } finally {
      const duration = Date.now() - startTime;
      await recordMetric("commerce.tool.execution", 1, {
        tool: toolName,
        duration_ms: duration,
      });
    }
  }

  // ============================================
  // MARKETPLACE TOOL IMPLEMENTATIONS
  // ============================================

  private async createListing(
    sellerPhone: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; listingId?: string; error?: string }> {
    try {
      const title = data.title || data.product_name || "Untitled Listing";

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
          category: data.category || "other",
          location_text: data.location_text || null,
          lat: data.lat || null,
          lng: data.lng || null,
          photos: data.photos || [],
          attributes: {},
          status: "active",
          source_agent: "commerce",
        })
        .select("id")
        .single();

      if (error) {
        await logStructuredEvent(
          "COMMERCE_CREATE_LISTING_ERROR",
          { error: error.message, correlationId: this.correlationId },
          "error"
        );
        return { success: false, error: error.message };
      }

      await logStructuredEvent("COMMERCE_LISTING_CREATED", {
        listingId: listing.id,
        category: data.category,
        correlationId: this.correlationId,
      });

      await recordMetric("commerce.listing.created", 1, { category: data.category });

      // Notify matching buyers
      this.notifyMatchingBuyers(listing.id); // Fire and forget

      return { success: true, listingId: listing.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async searchMarketplace(
    params: Record<string, any>,
    location?: { lat: number; lng: number }
  ): Promise<any> {
    try {
      if (!location) {
        // Simple text search
        const { data: listings } = await this.supabase
          .from("unified_listings")
          .select("*")
          .eq("domain", "marketplace")
          .eq("status", "active")
          .or(`title.ilike.%${params.query}%,description.ilike.%${params.query}%`)
          .limit(10);

        return { listings: listings || [] };
      }

      // Proximity search
      const { data: listings } = await this.supabase.rpc(
        "search_marketplace_listings_nearby",
        {
          search_term: params.query,
          user_lat: location.lat,
          user_lng: location.lng,
          radius_km: params.radius_km || 10,
          result_limit: 10,
        }
      );

      return { listings: listings || [] };
    } catch (error) {
      await logStructuredEvent(
        "COMMERCE_SEARCH_MARKETPLACE_ERROR",
        { error: String(error), correlationId: this.correlationId },
        "error"
      );
      return { listings: [] };
    }
  }

  private async initiatePurchase(
    buyerPhone: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      // Get listing details
      const { data: listing } = await this.supabase
        .from("unified_listings")
        .select("*")
        .eq("id", params.listing_id)
        .single();

      if (!listing) {
        return { success: false, error: "Listing not found" };
      }

      // Create transaction
      const { data: transaction, error } = await this.supabase
        .from("marketplace_transactions")
        .insert({
          listing_id: params.listing_id,
          buyer_phone: buyerPhone,
          seller_phone: listing.owner_phone,
          agreed_price: params.offered_price || listing.price,
          currency: "RWF",
          status: "pending",
          escrow_requested: params.escrow_requested || false,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Generate MoMo USSD payment link
      const merchantCode = Deno.env.get("MOMO_MERCHANT_CODE");
      const amount = params.offered_price || listing.price;
      const ussdCode = `*182*8*1*${merchantCode}*${amount}#`;

      return {
        success: true,
        transactionId: transaction.id,
        paymentMethod: "momo_ussd",
        ussdCode,
        ussdLink: `tel:${ussdCode}`,
        instructions: `Tap to pay ${amount} RWF: ${ussdCode}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // BUSINESS DIRECTORY TOOL IMPLEMENTATIONS
  // ============================================

  private async searchBusinesses(
    params: Record<string, any>,
    location?: { lat: number; lng: number }
  ): Promise<any> {
    try {
      if (!location) {
        // Text-based search
        let query = this.supabase
          .from("business_directory")
          .select("*")
          .eq("status", "ACTIVE");

        if (params.query) {
          query = query.or(
            `name.ilike.%${params.query}%,category.ilike.%${params.query}%`
          );
        }

        if (params.category) {
          query = query.eq("category", params.category);
        }

        if (params.city) {
          query = query.eq("city", params.city);
        }

        if (params.min_rating) {
          query = query.gte("rating", params.min_rating);
        }

        const { data: businesses } = await query.limit(params.limit || 10);

        return { businesses: businesses || [] };
      }

      // GPS-based proximity search
      const { data: businesses } = await this.supabase.rpc("search_nearby_businesses", {
        _lat: location.lat,
        _lng: location.lng,
        _radius_km: params.radius_km || 50,
        _category: params.category || null,
        _query: params.query || null,
        _limit: params.limit || 10,
      });

      return { businesses: businesses || [] };
    } catch (error) {
      await logStructuredEvent(
        "COMMERCE_SEARCH_BUSINESSES_ERROR",
        { error: String(error), correlationId: this.correlationId },
        "error"
      );
      return { businesses: [] };
    }
  }

  private async getBusinessDetails(businessId: string): Promise<any> {
    const { data: business, error } = await this.supabase
      .from("business_directory")
      .select("*")
      .eq("id", businessId)
      .single();

    if (error || !business) {
      return { error: "Business not found" };
    }

    return { business };
  }

  private async findNearby(
    params: Record<string, any>,
    session: UnifiedSession
  ): Promise<any> {
    if (!session.location) {
      return { error: "Location required. Please share your location." };
    }

    const results: any[] = [];

    // Search businesses
    if (params.type === "business" || params.type === "all") {
      const { data: businesses } = await this.supabase.rpc("search_nearby_businesses", {
        _lat: session.location.lat,
        _lng: session.location.lng,
        _radius_km: params.radius_km || 5,
        _category: params.category || null,
        _query: null,
        _limit: 5,
      });

      if (businesses) {
        results.push(...businesses.map((b: any) => ({ ...b, type: "business" })));
      }
    }

    // Search marketplace listings
    if (params.type === "listing" || params.type === "all") {
      const { data: listings } = await this.supabase.rpc(
        "search_marketplace_listings_nearby",
        {
          search_term: params.category || "",
          user_lat: session.location.lat,
          user_lng: session.location.lng,
          radius_km: params.radius_km || 5,
          result_limit: 5,
        }
      );

      if (listings) {
        results.push(...listings.map((l: any) => ({ ...l, type: "listing" })));
      }
    }

    // Sort by distance
    results.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));

    return { results: results.slice(0, 10) };
  }

  private async getDirections(
    params: Record<string, any>,
    session: UnifiedSession
  ): Promise<any> {
    const table =
      params.target_type === "business" ? "business_directory" : "unified_listings";
    const { data: target } = await this.supabase
      .from(table)
      .select("lat, lng, name, title")
      .eq("id", params.target_id)
      .single();

    if (!target || !target.lat || !target.lng) {
      return { error: "Location not available" };
    }

    const name = target.name || target.title;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`;

    return {
      name,
      lat: target.lat,
      lng: target.lng,
      googleMapsUrl,
      message: `🗺️ Directions to ${name}:\n${googleMapsUrl}`,
    };
  }

  private async saveFavorite(
    userPhone: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      const { error } = await this.supabase.from("user_favorites").insert({
        user_phone: userPhone,
        target_id: params.target_id,
        target_type: params.target_type,
        notes: params.notes || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, message: "Saved to favorites!" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async registerBusiness(
    ownerPhone: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      const { data: business, error } = await this.supabase
        .from("business_directory")
        .insert({
          name: params.name,
          category: params.category,
          description: params.description || null,
          city: params.city,
          address: params.address || null,
          phone: params.phone || ownerPhone,
          source: "user_generated",
          status: "ACTIVE",
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await recordMetric("commerce.business.registered", 1, {
        category: params.category,
      });

      return {
        success: true,
        businessId: business.id,
        message: "Business registered successfully!",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // BUSINESS BROKER TOOL IMPLEMENTATIONS
  // ============================================

  private async findBusinessPartners(
    params: Record<string, any>,
    location?: { lat: number; lng: number }
  ): Promise<any> {
    try {
      let query = this.supabase
        .from("business_opportunities")
        .select("*")
        .eq("partnership_type", params.partnership_type)
        .eq("status", "active");

      if (params.industry) {
        query = query.eq("industry", params.industry);
      }

      if (params.city) {
        query = query.eq("city", params.city);
      }

      const { data: opportunities } = await query.limit(10);

      return { opportunities: opportunities || [] };
    } catch (error) {
      return { opportunities: [] };
    }
  }

  private async createPartnershipOpportunity(
    ownerPhone: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      const { data: opportunity, error } = await this.supabase
        .from("business_opportunities")
        .insert({
          owner_phone: ownerPhone,
          title: params.title,
          industry: params.industry,
          type: params.type,
          description: params.description || null,
          investment_range: params.investment_range || null,
          status: "active",
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        opportunityId: opportunity.id,
        message: "Opportunity posted successfully!",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // TRANSACTION & TRUST TOOL IMPLEMENTATIONS
  // ============================================

  private async rateAndReview(
    reviewerPhone: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      const { error } = await this.supabase.from("ratings_reviews").insert({
        target_id: params.target_id,
        target_type: params.target_type,
        reviewer_phone: reviewerPhone,
        rating: params.rating,
        review_text: params.review_text || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Update aggregate rating
      await this.updateAggregateRating(params.target_id, params.target_type);

      return { success: true, message: "Thank you for your review!" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async requestEscrow(params: Record<string, any>): Promise<any> {
    try {
      const { data: escrow, error } = await this.supabase
        .from("escrow_transactions")
        .insert({
          transaction_id: params.transaction_id,
          escrow_amount: params.amount,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        escrowId: escrow.id,
        message:
          "Escrow initiated. Buyer must deposit funds before seller ships item.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async reportIssue(
    reporterPhone: string,
    params: Record<string, any>
  ): Promise<any> {
    try {
      const { error } = await this.supabase.from("content_moderation").insert({
        content_id: params.target_id,
        content_type: params.target_type,
        reporter_phone: reporterPhone,
        reason: params.reason,
        details: params.details || null,
        status: "pending",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: "Report submitted. Our team will review it shortly.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // UTILITY TOOL IMPLEMENTATIONS
  // ============================================

  private async searchHybrid(
    params: Record<string, any>,
    session: UnifiedSession
  ): Promise<any> {
    const results: any[] = [];

    // 1. Search marketplace
    const marketplaceResults = await this.searchMarketplace(params, session.location);
    if (marketplaceResults.listings) {
      results.push(
        ...marketplaceResults.listings.map((l: any) => ({ ...l, source: "marketplace" }))
      );
    }

    // 2. Search business directory
    const businessResults = await this.searchBusinesses(params, session.location);
    if (businessResults.businesses) {
      results.push(
        ...businessResults.businesses.map((b: any) => ({ ...b, source: "directory" }))
      );
    }

    // 3. Search Google Places (if enabled)
    if (params.include_google_places && session.location) {
      const googleResults = await this.searchGooglePlaces(
        params.query,
        session.location,
        params.radius_km || 10
      );
      if (googleResults.places) {
        results.push(
          ...googleResults.places.map((p: any) => ({ ...p, source: "google_places" }))
        );
      }
    }

    // Sort by relevance and distance
    results.sort((a, b) => {
      if (a.distance_km && b.distance_km) {
        return a.distance_km - b.distance_km;
      }
      return 0;
    });

    return { results: results.slice(0, 10) };
  }

  private async getMarketPrices(params: Record<string, any>): Promise<any> {
    try {
      let query = this.supabase
        .from("unified_listings")
        .select("price, title")
        .eq("domain", "marketplace")
        .eq("status", "active")
        .not("price", "is", null);

      if (params.category) {
        query = query.eq("category", params.category);
      }

      if (params.product_name) {
        query = query.ilike("title", `%${params.product_name}%`);
      }

      const { data: listings } = await query.limit(20);

      if (!listings || listings.length === 0) {
        return { message: "No price data available for this category" };
      }

      const prices = listings.map((l) => l.price).sort((a, b) => a - b);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const min = prices[0];
      const max = prices[prices.length - 1];
      const median = prices[Math.floor(prices.length / 2)];

      return {
        category: params.category,
        product_name: params.product_name,
        sample_size: listings.length,
        prices: {
          min,
          max,
          avg: Math.round(avg),
          median,
        },
        message: `Typical prices: ${min}-${max} RWF (avg: ${Math.round(avg)} RWF)`,
      };
    } catch (error) {
      return { message: "Unable to fetch price data" };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async notifyMatchingBuyers(listingId: string): Promise<void> {
    try {
      const { data: matches } = await this.supabase.rpc(
        "find_matching_marketplace_buyers",
        { p_listing_id: listingId }
      );

      if (matches && matches.length > 0) {
        await logStructuredEvent("COMMERCE_MATCHES_FOUND", {
          listingId,
          matchCount: matches.length,
          correlationId: this.correlationId,
        });

        for (const match of matches) {
          await this.supabase.from("unified_matches").insert({
            listing_id: listingId,
            seeker_phone: match.buyer_phone,
            owner_phone: match.seller_phone,
            domain: "marketplace",
            distance_km: match.distance_km,
            match_score: match.match_score,
            status: "suggested",
          });
        }

        await recordMetric("commerce.matches.created", matches.length);
      }
    } catch (error) {
      // Non-critical error, log and continue
      console.error("Error notifying buyers:", error);
    }
  }

  private async updateAggregateRating(
    targetId: string,
    targetType: string
  ): Promise<void> {
    try {
      const { data: reviews } = await this.supabase
        .from("ratings_reviews")
        .select("rating")
        .eq("target_id", targetId)
        .eq("target_type", targetType);

      if (!reviews || reviews.length === 0) return;

      const avgRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      const table =
        targetType === "business" ? "business_directory" : "unified_listings";

      await this.supabase
        .from(table)
        .update({
          rating: Math.round(avgRating * 10) / 10,
          review_count: reviews.length,
        })
        .eq("id", targetId);
    } catch (error) {
      console.error("Error updating aggregate rating:", error);
    }
  }

  private async searchGooglePlaces(
    query: string,
    location: { lat: number; lng: number },
    radiusKm: number
  ): Promise<{ places: any[] }> {
    // TODO: Implement Google Places API integration (Phase 2)
    // For now, return empty results
    return { places: [] };
  }
}
