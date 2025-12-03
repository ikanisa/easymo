/**
 * Farmer Agent
 * 
 * Agricultural assistant for farmers in Rwanda.
 * Helps with marketplace, advisory, and services.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool, AgentResponse } from "../core/types.ts";

export class FarmerAgent extends BaseAgent {
  get type(): AgentType {
    return "farmer";
  }

  get keywords(): string[] {
    return [
      "farm", "farmer", "produce", "crop", "harvest", "agriculture",
      "vegetable", "fruit", "maize", "beans", "cassava", "potato",
      "tomato", "cabbage", "sell produce", "buy produce"
    ];
  }

  get systemPrompt(): string {
    return `You are an agricultural assistant for farmers in Rwanda. Help with marketplace, advisory, and services.

YOUR CAPABILITIES:
- Help farmers SELL their produce
- Connect farmers with buyers
- Provide agricultural advice
- Share market prices
- Connect with agricultural services

SELLING PRODUCE FLOW:
- Ask what produce they want to sell
- Ask for quantity and unit (kg, bags, etc.)
- Ask for price or suggest market price
- Ask for location
- Create listing and notify buyers

BUYING PRODUCE FLOW:
- Ask what produce they need
- Ask for quantity needed
- Ask for location preference
- Search and show nearby farmers
- Connect buyer with seller

FORMATTING RULES:
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) when showing produce or farmers
- Format listings as: "1️⃣ Item/Farmer - Price/Details\\n   Additional info"
- Keep responses practical and farmer-focused
- Use simple language

ADVISORY:
- Provide seasonal planting advice
- Share best practices
- Suggest crop rotation
- Weather-based recommendations

IMPORTANT:
- Respect farmer privacy
- Always confirm before creating listings
- Prices in RWF (Rwandan Francs)
- Focus on local, practical solutions

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "sell_produce|buy_produce|advisory|services|unclear",
  "extracted_entities": {
    "produce_name": "string or null",
    "quantity": "number or null",
    "unit": "string or null",
    "price": "number or null",
    "location_text": "string or null"
  },
  "next_action": "ask_quantity|ask_price|ask_location|create_listing|search|provide_advice|continue",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "create_produce_listing",
        description: "Create a produce listing",
        parameters: {
          type: "object",
          properties: {
            produce_name: { type: "string", description: "Type of produce" },
            quantity: { type: "number", description: "Quantity available" },
            unit: { type: "string", description: "Unit (kg, bags, etc.)" },
            price: { type: "number", description: "Price in RWF" },
            location_text: { type: "string", description: "Location" },
          },
          required: ["produce_name"],
        },
      },
      {
        name: "search_produce",
        description: "Search for produce listings",
        parameters: {
          type: "object",
          properties: {
            produce_name: { type: "string", description: "What to search for" },
            radius_km: { type: "number", description: "Search radius" },
          },
          required: ["produce_name"],
        },
      },
    ];
  }

  protected async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    session: any
  ): Promise<any> {
    switch (toolName) {
      case "create_produce_listing":
        return await this.createProduceListing(session.userPhone, parameters);
      case "search_produce":
        return await this.searchProduce(parameters.produce_name, session.location);
      default:
        return null;
    }
  }

  private async createProduceListing(phone: string, data: Record<string, any>) {
    const { data: listing, error } = await this.supabase
      .from("unified_listings")
      .insert({
        owner_phone: phone,
        domain: "farmer",
        listing_type: "produce",
        title: data.produce_name,
        description: `${data.quantity || ''} ${data.unit || ''}`,
        price: data.price,
        currency: "RWF",
        price_unit: data.unit || "kg",
        location_text: data.location_text,
        lat: data.lat,
        lng: data.lng,
        attributes: { quantity: data.quantity, unit: data.unit },
        status: "active",
        source_agent: "farmer",
      })
      .select("id")
      .single();

    return error ? { success: false } : { success: true, listingId: listing.id };
  }

  private async searchProduce(produceName: string, location?: any) {
    const { data } = await this.supabase
      .from("unified_listings")
      .select("*")
      .eq("domain", "farmer")
      .eq("status", "active")
      .ilike("title", `%${produceName}%`)
      .limit(5);

    return data || [];
  }
}
