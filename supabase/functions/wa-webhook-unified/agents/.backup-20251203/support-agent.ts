/**
 * Support Agent
 * 
 * Fallback agent for general queries and navigation.
 * Helps users understand available services and routes to appropriate agents.
 */

import { BaseAgent } from "./base-agent.ts";
import {
  AgentType,
  Tool,
  WhatsAppMessage,
  UnifiedSession,
  AgentResponse,
} from "../core/types.ts";

export class SupportAgent extends BaseAgent {
  get type(): AgentType {
    return "support";
  }

  get keywords(): string[] {
    return ["help", "support", "question", "how", "what", "why", "problem", "issue"];
  }

  get systemPrompt(): string {
    return `You are EasyMO Support Agent, a helpful assistant for users in Rwanda.

YOUR ROLE:
- Help users understand available services
- Answer general questions
- Route users to the appropriate specialized agent

AVAILABLE SERVICES:
1. **Jobs** - Find jobs or post job listings
2. **Property** - Find rentals or list properties
3. **Marketplace** - Buy/sell products and services
4. **Farmer** - Agricultural produce listings and market info
5. **Waiter** - Restaurant/bar discovery and ordering
6. **Insurance** - Motor insurance quotes and renewals
7. **Rides** - Find drivers/passengers and schedule trips
8. **Sales** - Sales and customer management
9. **Business Broker** - Business opportunities and partnerships

HANDOFF RULES:
- If user asks about jobs → handoff_to: "jobs"
- If user asks about property/rentals → handoff_to: "property"
- If user asks about buying/selling products → handoff_to: "marketplace"
- If user asks about farming/produce → handoff_to: "farmer"
- If user asks about food/restaurants → handoff_to: "waiter"
- If user asks about insurance → handoff_to: "insurance"
- If user asks about rides/transport → handoff_to: "rides"
- If user asks about sales → handoff_to: "sales"
- If user asks about business opportunities → handoff_to: "business_broker"

OUTPUT FORMAT (JSON):
{
  "response_text": "Your helpful message",
  "intent": "help|navigate|unclear",
  "handoff_to": null or "agent_type",
  "handoff_reason": "Why routing to that agent"
}

Be friendly, concise, and helpful!`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "show_services_menu",
        description: "Show menu of available services",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
  }

  /**
   * Override process to handle simple menu-based navigation
   */
  async process(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    const lowerBody = message.body.toLowerCase();

    // Check for menu request
    if (lowerBody.includes("menu") || lowerBody.includes("services") || lowerBody.includes("help")) {
      return this.showServicesMenu();
    }

    // Otherwise use AI processing
    return super.process(message, session);
  }

  /**
   * Show services menu
   */
  private showServicesMenu(): AgentResponse {
    return this.formatListResponse(
      "Welcome to EasyMO! 🎉\n\nWhat would you like to do today?",
      "Our Services",
      [
        {
          id: "jobs",
          title: "💼 Jobs",
          description: "Find work or hire talent",
        },
        {
          id: "property",
          title: "🏠 Property",
          description: "Find rentals or list properties",
        },
        {
          id: "marketplace",
          title: "🛍️ Marketplace",
          description: "Buy and sell products",
        },
        {
          id: "farmer",
          title: "🌾 Farmer",
          description: "Agricultural produce market",
        },
        {
          id: "waiter",
          title: "🍽️ Dining",
          description: "Restaurants and food ordering",
        },
        {
          id: "insurance",
          title: "🚗 Insurance",
          description: "Motor insurance services",
        },
        {
          id: "rides",
          title: "🚕 Rides",
          description: "Find rides or passengers",
        },
      ]
    );
  }

  /**
   * Execute tool calls
   */
  protected async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    session: UnifiedSession
  ): Promise<any> {
    if (toolName === "show_services_menu") {
      return this.showServicesMenu();
    }
  }
}
