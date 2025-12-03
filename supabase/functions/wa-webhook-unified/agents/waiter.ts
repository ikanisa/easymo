/**
 * Waiter Agent (Consolidated)
 * 
 * Restaurant and bar service assistant.
 * Copied and updated from wa-webhook-ai-agents.
 * Now uses AIProviderFactory for dual provider support.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";
import { AIProviderFactory, type Message } from "../core/providers/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export class WaiterAgent extends BaseAgent {
  get type(): AgentType {
    return "waiter";
  }

  get keywords(): string[] {
    return [
      "menu", "food", "order", "restaurant", "bar", "drink", "meal", "eat",
      "dining", "table", "reservation", "book", "cuisine", "chef", "waiter",
    ];
  }

  get systemPrompt(): string {
    return `You are a friendly and professional waiter AI assistant at easyMO restaurants and bars.

YOUR ROLE:
- Help customers browse menus and place food/drink orders
- Provide recommendations based on preferences
- Answer questions about dishes, ingredients, prices
- Handle table reservations and bookings
- Process orders and confirm details
- Provide excellent customer service

GUIDELINES:
- Be warm, friendly, and professional
- Ask clarifying questions when needed
- Suggest popular items or chef specials
- Mention any promotions or deals
- Confirm order details before finalizing
- Provide estimated preparation/delivery times
- Handle allergies and dietary restrictions carefully

CAPABILITIES:
- Browse restaurant menus
- Place orders (food & drinks)
- Make table reservations
- Get recommendations
- Check order status
- Process payments via mobile money

Keep responses concise and helpful. Always end with a clear next step or question.
Type "menu" to return to main services menu.

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "browse_menu|place_order|make_reservation|get_recommendation|check_status|unclear",
  "extracted_entities": {},
  "next_action": "continue|complete|handoff",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "search_restaurants",
        description: "Search for restaurants nearby",
        parameters: {
          type: "object",
          properties: {
            cuisine: {
              type: "string",
              description: "Type of cuisine (e.g., Italian, African, Asian)",
            },
            priceRange: {
              type: "string",
              description: "Price range (budget, mid-range, fine-dining)",
            },
          },
          required: [],
        },
      },
      {
        name: "get_menu",
        description: "Get menu for a specific restaurant",
        parameters: {
          type: "object",
          properties: {
            restaurantId: {
              type: "string",
              description: "Restaurant identifier",
            },
            category: {
              type: "string",
              description: "Menu category (appetizers, mains, desserts, drinks)",
            },
          },
          required: ["restaurantId"],
        },
      },
      {
        name: "place_order",
        description: "Place a food/drink order",
        parameters: {
          type: "object",
          properties: {
            restaurantId: {
              type: "string",
              description: "Restaurant identifier",
            },
            items: {
              type: "string",
              description: "JSON array of order items",
            },
            notes: {
              type: "string",
              description: "Special instructions",
            },
          },
          required: ["restaurantId", "items"],
        },
      },
    ];
  }

  /**
   * Process message using AI provider with fallback
   */
  override async process(
    message: { from: string; body: string; type: string; timestamp: string; id: string },
    session: {
      id: string;
      userPhone: string;
      currentAgent: AgentType;
      conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string; timestamp: string }>;
      activeFlow?: string;
      flowStep?: string;
      collectedData: Record<string, unknown>;
      location?: { lat: number; lng: number };
      status: "active" | "completed" | "expired";
      lastMessageAt: string;
      expiresAt: string;
    }
  ): Promise<{ text: string; handoffTo?: AgentType; handoffReason?: string }> {
    await logStructuredEvent("WAITER_AGENT_PROCESSING", {
      sessionId: session.id,
      messageType: message.type,
    });

    try {
      // Build messages for AI provider
      const messages: Message[] = [
        { role: "system", content: this.systemPrompt },
        ...session.conversationHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: message.body },
      ];

      // Use AI provider with fallback
      const response = await AIProviderFactory.withFallback(async (provider) => {
        return await provider.chat(messages, {
          temperature: 0.8,
          maxTokens: 500,
        });
      });

      await logStructuredEvent("WAITER_AGENT_RESPONSE", {
        sessionId: session.id,
        responseLength: response.length,
      });

      // Try to parse JSON response, fallback to raw text
      try {
        const parsed = JSON.parse(response);
        return {
          text: parsed.response_text || parsed.text || response,
          handoffTo: parsed.handoff_to,
          handoffReason: parsed.handoff_reason,
        };
      } catch {
        return { text: response };
      }
    } catch (error) {
      await logStructuredEvent("WAITER_AGENT_ERROR", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      }, "error");

      return {
        text: "Sorry, I'm having trouble right now. Please try again or type 'menu' to go back.",
      };
    }
  }
}
