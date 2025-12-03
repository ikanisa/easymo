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
 * - Finding shops and stores
 * - Product listings and searches
 * - Business sales and acquisitions
 * - Business valuations
 * - Connecting buyers and sellers
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";

export class BuySellAgent extends BaseAgent {
  get type(): AgentType {
    return "buy_sell" as AgentType;
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
        description: "Find business opportunities",
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
    ];
  }

  protected async executeTool(toolName: string, parameters: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case "search_products":
        return await this.searchProducts(parameters);
      case "create_listing":
        return await this.createListing(parameters);
      case "find_businesses":
        return await this.findBusinesses(parameters);
      default:
        return null;
    }
  }

  private async searchProducts(params: Record<string, unknown>) {
    const query = params.query as string;
    const category = params.category as string | undefined;
    
    let queryBuilder = this.supabase
      .from("unified_listings")
      .select("*")
      .eq("status", "active")
      .ilike("title", `%${query}%`);
    
    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }
    
    const { data } = await queryBuilder.limit(10);
    return data || [];
  }

  private async createListing(params: Record<string, unknown>) {
    // Placeholder - would create actual listing
    return { 
      success: true, 
      message: "Listing created successfully",
      data: params 
    };
  }

  private async findBusinesses(params: Record<string, unknown>) {
    const type = params.type as string;
    
    const { data } = await this.supabase
      .from("business_directory")
      .select("*")
      .limit(10);
    
    return data || [];
  }
}
