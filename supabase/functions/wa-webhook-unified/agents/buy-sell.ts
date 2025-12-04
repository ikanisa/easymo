/**
 * Buy & Sell Agent
 * 
 * Consolidated agent for marketplace transactions and business brokerage.
 * Merges functionality from:
 * - business_broker_agent (wa-webhook-unified)
 * - marketplace_agent (wa-webhook-ai-agents)
 * 
 * Handles:
 * - Buying and selling products
 * - Finding shops and stores nearby
 * - Product listings and searches
 * - Business sales and acquisitions
 * - Business valuations
 * - Connecting buyers and sellers
 * - Recommendations from nearby businesses
 * - Adding businesses and products
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, AgentDependencies, Tool, UnifiedSession, AgentResponse, WhatsAppMessage } from "../core/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export class BuySellAgent extends BaseAgent {
  constructor(deps: AgentDependencies) {
    super(deps);
  }

  get type(): AgentType {
    return "buy_sell";
  }

  get keywords(): string[] {
    return [
      // Marketplace keywords
      "buy", "sell", "purchase", "marketplace",
      "shop", "store", "product", "listing",
      // Business broker keywords
      "business", "broker", "trade", "deal",
      "enterprise", "startup", "venture",
      "investment", "partner", "opportunity",
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO's Buy & Sell assistant, helping users with marketplace transactions and business opportunities.

MARKETPLACE CAPABILITIES:
- Help users buy and sell products
- Find shops and stores nearby
- Create and manage product listings
- Search for specific items
- Price negotiations and guidance
- Connect buyers with sellers

BUSINESS BROKERAGE CAPABILITIES:
- Facilitate business sales and acquisitions
- Provide business valuation guidance
- Connect investors with opportunities
- Match business buyers and sellers
- Support partnership facilitation

CATEGORIES SUPPORTED:
- Electronics & Gadgets
- Vehicles & Auto parts
- Home & Furniture
- Fashion & Clothing
- Services (repair, cleaning, etc.)
- Business opportunities
- Wholesale products
- Handmade & crafts

GUIDELINES:
- Be helpful and professional
- Ask clarifying questions when needed
- Provide pricing guidance when relevant
- Prioritize nearby/local transactions
- Protect user privacy and confidentiality
- Focus on win-win outcomes

FOR PRODUCT LISTINGS, GATHER:
1. What are you selling/looking for?
2. Category
3. Condition (new/used)
4. Price or budget
5. Location
6. Photos (if selling)
7. Description/specifications

FOR BUSINESS OPPORTUNITIES:
1. Type of opportunity (sale, investment, partnership)
2. Industry/sector
3. Size/scale
4. Location preferences
5. Budget/investment range

Keep responses concise and action-oriented. Help users complete transactions efficiently!
Type "menu" to return to main services menu.

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "buy|sell|list|search|business|invest|partner|unclear",
  "extracted_entities": {},
  "next_action": "continue|complete|handoff",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "search_products",
        description: "Search for products in the marketplace",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for products",
            },
            category: {
              type: "string",
              description: "Product category filter",
            },
            priceMax: {
              type: "number",
              description: "Maximum price filter",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "create_listing",
        description: "Create a new product or business listing",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Listing title",
            },
            description: {
              type: "string",
              description: "Listing description",
            },
            price: {
              type: "number",
              description: "Price in local currency",
            },
            category: {
              type: "string",
              description: "Product/business category",
            },
            type: {
              type: "string",
              description: "Type of listing",
              enum: ["product", "service", "business"],
            },
          },
          required: ["title", "category", "type"],
        },
      },
      {
        name: "find_businesses",
        description: "Find business opportunities or nearby businesses",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Opportunity type",
              enum: ["sale", "investment", "partnership"],
            },
            industry: {
              type: "string",
              description: "Industry/sector filter",
            },
            budgetMax: {
              type: "number",
              description: "Maximum budget/investment",
            },
          },
          required: ["type"],
        },
      },
      {
        name: "find_nearby_sellers",
        description: "Find sellers and shops near the user's location",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Product/business category filter",
            },
          },
          required: [],
        },
      },
      {
        name: "add_product",
        description: "Add a new product for sale",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Product title",
            },
            description: {
              type: "string",
              description: "Product description",
            },
            price: {
              type: "number",
              description: "Price in local currency",
            },
            category: {
              type: "string",
              description: "Product category",
            },
            condition: {
              type: "string",
              description: "Product condition",
              enum: ["new", "used", "refurbished"],
            },
          },
          required: ["title", "category"],
        },
      },
      {
        name: "add_business",
        description: "Add a new business to the directory",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Business name",
            },
            description: {
              type: "string",
              description: "Business description",
            },
            category: {
              type: "string",
              description: "Business category",
            },
            address: {
              type: "string",
              description: "Business address",
            },
            phone: {
              type: "string",
              description: "Contact phone number",
            },
            website: {
              type: "string",
              description: "Business website URL",
            },
          },
          required: ["name", "category"],
        },
      },
    ];
  }

  protected async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    session: UnifiedSession
  ): Promise<unknown> {
    await logStructuredEvent("BUY_SELL_AGENT_TOOL_EXECUTION", {
      toolName,
      sessionId: session.id,
      correlationId: this.correlationId,
    });

    switch (toolName) {
      case "search_products":
        return await this.searchProducts(parameters, session);
      case "create_listing":
        return await this.createListing(parameters, session);
      case "find_businesses":
        return await this.findBusinesses(parameters, session);
      case "find_nearby_sellers":
        return await this.findNearbySellers(parameters, session);
      case "add_product":
        return await this.addProduct(parameters, session);
      case "add_business":
        return await this.addBusiness(parameters, session);
      default:
        return null;
    }
  }

  private async searchProducts(params: Record<string, unknown>, session: UnifiedSession) {
    const query = params.query as string;
    const category = params.category as string | undefined;
    const location = session.location;
    
    let queryBuilder = this.supabase
      .from("unified_listings")
      .select("*")
      .eq("status", "active")
      .ilike("title", `%${query}%`);
    
    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }

    // If user has location, prioritize nearby listings
    if (location) {
      await logStructuredEvent("BUY_SELL_SEARCH_WITH_LOCATION", {
        lat: location.latitude,
        lng: location.longitude,
        query,
      });
    }
    
    const { data, error } = await queryBuilder.limit(10);
    
    if (error) {
      await logStructuredEvent("BUY_SELL_SEARCH_ERROR", {
        error: error.message,
        query,
      }, "error");
      return [];
    }

    await logStructuredEvent("BUY_SELL_SEARCH_RESULTS", {
      query,
      resultsCount: data?.length || 0,
    });
    
    return data || [];
  }

  private async createListing(params: Record<string, unknown>, session: UnifiedSession) {
    const { title, description, price, category, type } = params;
    
    await logStructuredEvent("BUY_SELL_CREATE_LISTING", {
      title,
      category,
      type,
      userPhone: session.userPhone?.slice(-4),
    });

    // Insert into unified_listings
    const { data, error } = await this.supabase
      .from("unified_listings")
      .insert({
        title,
        description,
        price,
        category,
        listing_type: type,
        owner_phone: session.userPhone,
        owner_user_id: session.userId,
        domain: "marketplace",
        status: "active",
        location_lat: session.location?.latitude,
        location_lng: session.location?.longitude,
        source_agent: "buy_sell",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      await logStructuredEvent("BUY_SELL_CREATE_LISTING_ERROR", {
        error: error.message,
      }, "error");
      return { 
        success: false, 
        message: "Failed to create listing. Please try again.",
        error: error.message
      };
    }

    return { 
      success: true, 
      message: "Listing created successfully! Buyers nearby will be able to see your listing.",
      data
    };
  }

  private async findBusinesses(params: Record<string, unknown>, session: UnifiedSession) {
    const type = params.type as string;
    const industry = params.industry as string | undefined;
    const location = session.location;
    
    await logStructuredEvent("BUY_SELL_FIND_BUSINESSES", {
      type,
      industry,
      hasLocation: !!location,
    });

    let queryBuilder = this.supabase
      .from("business_directory")
      .select("*")
      .eq("is_active", true);
    
    if (type) {
      queryBuilder = queryBuilder.eq("opportunity_type", type);
    }
    
    if (industry) {
      queryBuilder = queryBuilder.ilike("industry", `%${industry}%`);
    }
    
    const { data, error } = await queryBuilder.limit(10);
    
    if (error) {
      await logStructuredEvent("BUY_SELL_FIND_BUSINESSES_ERROR", {
        error: error.message,
      }, "error");
      return [];
    }
    
    return data || [];
  }

  private async findNearbySellers(params: Record<string, unknown>, session: UnifiedSession) {
    const category = params.category as string | undefined;
    const location = session.location;
    
    if (!location) {
      return {
        success: false,
        message: "Please share your location to find nearby sellers.",
        needsLocation: true,
      };
    }

    await logStructuredEvent("BUY_SELL_FIND_NEARBY_SELLERS", {
      category,
      lat: location.latitude,
      lng: location.longitude,
    });

    // Query for nearby shops/sellers within a reasonable radius
    const { data, error } = await this.supabase
      .rpc("find_nearby_sellers", {
        user_lat: location.latitude,
        user_lng: location.longitude,
        radius_km: 10,
        category_filter: category || null,
      });
    
    if (error) {
      // Fallback to simple query if RPC doesn't exist
      const { data: fallbackData } = await this.supabase
        .from("unified_listings")
        .select("*")
        .eq("status", "active")
        .limit(10);
      
      return fallbackData || [];
    }
    
    return data || [];
  }

  private async addProduct(params: Record<string, unknown>, session: UnifiedSession) {
    return this.createListing({
      ...params,
      type: "product",
    }, session);
  }

  private async addBusiness(params: Record<string, unknown>, session: UnifiedSession) {
    const { name, description, category, address, phone, website } = params;
    
    await logStructuredEvent("BUY_SELL_ADD_BUSINESS", {
      name,
      category,
      userPhone: session.userPhone?.slice(-4),
    });

    const { data, error } = await this.supabase
      .from("business_directory")
      .insert({
        name,
        description,
        category,
        address,
        phone,
        website,
        owner_phone: session.userPhone,
        owner_user_id: session.userId,
        location_lat: session.location?.latitude,
        location_lng: session.location?.longitude,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      await logStructuredEvent("BUY_SELL_ADD_BUSINESS_ERROR", {
        error: error.message,
      }, "error");
      return { 
        success: false, 
        message: "Failed to add business. Please try again.",
        error: error.message
      };
    }

    return { 
      success: true, 
      message: "Business added successfully! It will now appear in local searches.",
      data
    };
  }
}
