/**
 * Waiter Agent
 * 
 * Restaurant and food ordering assistant.
 * Helps users discover restaurants, view menus, and place orders.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";

export class WaiterAgent extends BaseAgent {
  get type(): AgentType {
    return "waiter";
  }

  get keywords(): string[] {
    return [
      "menu", "food", "order", "restaurant", "bar", "drink", "meal",
      "eat", "dining", "table", "reservation", "book", "cuisine"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Waiter Agent, a helpful assistant for dining and food ordering in Rwanda.

YOUR CAPABILITIES:
- Help users find restaurants and bars
- Show menus and food options
- Take food orders
- Make reservations
- Provide dining recommendations

RESTAURANT DISCOVERY:
- Ask what type of cuisine they want
- Ask for location preference
- Show nearby restaurants with ratings
- Provide contact details

ORDERING FLOW:
- Show restaurant menu
- Help select items
- Confirm order details
- Provide total cost
- Connect with restaurant

RESERVATION FLOW:
- Ask for date and time
- Ask for number of people
- Ask for special requests
- Confirm reservation

RULES:
- Be friendly and helpful
- Use food emojis appropriately (🍽️, 🍕, 🍔, 🍜)
- Always confirm orders before submitting
- Provide accurate pricing
- Respect dietary restrictions

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "find_restaurant|view_menu|order_food|make_reservation|inquiry|unclear",
  "extracted_entities": {
    "cuisine_type": "string or null",
    "location_text": "string or null",
    "restaurant_name": "string or null",
    "order_items": [],
    "reservation_date": "string or null",
    "party_size": "number or null"
  },
  "next_action": "search_restaurants|show_menu|confirm_order|make_reservation|continue",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "search_restaurants",
        description: "Search for restaurants",
        parameters: {
          type: "object",
          properties: {
            cuisine_type: { type: "string", description: "Type of cuisine" },
            location_text: { type: "string", description: "Location" },
          },
          required: [],
        },
      },
      {
        name: "get_menu",
        description: "Get restaurant menu",
        parameters: {
          type: "object",
          properties: {
            restaurant_id: { type: "string", description: "Restaurant ID" },
          },
          required: ["restaurant_id"],
        },
      },
    ];
  }

  protected async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    switch (toolName) {
      case "search_restaurants":
        return await this.searchRestaurants(parameters);
      case "get_menu":
        return await this.getMenu(parameters.restaurant_id);
      default:
        return null;
    }
  }

  private async searchRestaurants(params: Record<string, any>) {
    const { data } = await this.supabase
      .from("business_directory")
      .select("*")
      .eq("category", "Restaurant")
      .limit(5);
    return data || [];
  }

  private async getMenu(restaurantId: string) {
    // Placeholder - would fetch actual menu
    return { items: [] };
  }
}
