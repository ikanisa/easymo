/**
 * Farmer Agent (Consolidated)
 * 
 * Agricultural support and market assistant.
 * Copied and updated from wa-webhook-ai-agents.
 * Now uses AIProviderFactory for dual provider support.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";
import { AIProviderFactory, type Message } from "../core/providers/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export class FarmerAgent extends BaseAgent {
  get type(): AgentType {
    return "farmer";
  }

  get keywords(): string[] {
    return [
      "farm", "produce", "crop", "harvest", "agriculture", "vegetable", "fruit",
      "maize", "beans", "cassava", "potato", "tomato", "cabbage", "farming",
      "seeds", "fertilizer", "pesticide", "irrigation",
    ];
  }

  get systemPrompt(): string {
    return `You are a knowledgeable and supportive farmer AI assistant at easyMO Farmers Market.

YOUR ROLE:
- Connect farmers with consumers directly (no middlemen)
- Provide agricultural advice and best practices
- Share current market prices for crops and produce
- Help farmers list their products
- Assist consumers in finding fresh, local produce
- Provide seasonal farming tips and recommendations

EXPERTISE AREAS:
- Crop cultivation and management
- Pest and disease control
- Soil health and fertilization
- Irrigation and water management
- Market price trends
- Post-harvest handling
- Organic farming practices
- Seasonal planting guides

GUIDELINES:
- Be supportive and encouraging to farmers
- Provide practical, actionable advice
- Use simple language (avoid complex jargon)
- Share local/regional farming knowledge
- Promote sustainable farming practices
- Help farmers get better prices by connecting directly to buyers
- Assist consumers in finding quality produce

PLATFORM CAPABILITIES:
- List fresh produce for sale
- Browse available crops and products
- Check current market prices
- Connect farmers with buyers
- Share farming tips and resources
- Seasonal crop recommendations
- Weather-based advice

Keep responses practical and helpful. Focus on empowering farmers and connecting them with consumers.
Type "menu" to return to main services menu.

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "list_produce|find_produce|check_prices|get_advice|weather|unclear",
  "extracted_entities": {},
  "next_action": "continue|complete|handoff",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "check_market_prices",
        description: "Check current market prices for crops",
        parameters: {
          type: "object",
          properties: {
            crop: {
              type: "string",
              description: "Crop name (e.g., maize, beans, tomatoes)",
            },
            region: {
              type: "string",
              description: "Region for price check",
            },
          },
          required: ["crop"],
        },
      },
      {
        name: "list_produce",
        description: "List produce for sale",
        parameters: {
          type: "object",
          properties: {
            cropName: {
              type: "string",
              description: "Name of the crop/produce",
            },
            quantity: {
              type: "string",
              description: "Quantity available (e.g., 50kg, 100 bunches)",
            },
            price: {
              type: "number",
              description: "Price per unit",
            },
            unit: {
              type: "string",
              description: "Unit of measurement (kg, bunch, piece)",
            },
          },
          required: ["cropName", "quantity", "price"],
        },
      },
      {
        name: "find_produce",
        description: "Find produce available nearby",
        parameters: {
          type: "object",
          properties: {
            cropName: {
              type: "string",
              description: "Crop name to search for",
            },
            maxDistance: {
              type: "number",
              description: "Maximum distance in km",
            },
          },
          required: ["cropName"],
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
    await logStructuredEvent("FARMER_AGENT_PROCESSING", {
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
          temperature: 0.7,
          maxTokens: 600,
        });
      });

      await logStructuredEvent("FARMER_AGENT_RESPONSE", {
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
      await logStructuredEvent("FARMER_AGENT_ERROR", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      }, "error");

      return {
        text: "Sorry, I'm having trouble right now. Please try again or type 'menu' to go back.",
      };
    }
  }
}
