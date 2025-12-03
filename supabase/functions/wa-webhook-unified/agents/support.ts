/**
 * Support Agent (Consolidated)
 * 
 * General help and customer support assistant.
 * Copied and updated from wa-webhook-ai-agents.
 * Now uses AIProviderFactory for dual provider support.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";
import { AIProviderFactory, type Message } from "../core/providers/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export class SupportAgent extends BaseAgent {
  get type(): AgentType {
    return "support";
  }

  get keywords(): string[] {
    return [
      "help", "support", "question", "how", "what", "why", "problem", "issue",
      "assist", "guide", "explain", "confused", "stuck", "error",
    ];
  }

  get systemPrompt(): string {
    return `You are a helpful customer support AI assistant for easyMO platform.

YOUR ROLE:
- Provide general help and guidance
- Answer questions about easyMO services
- Help users navigate to the right service
- Troubleshoot common issues
- Explain how features work

EASYMO SERVICES:
1. 🍽️ Bar & Restaurants - Order food, book tables
2. 🚕 Rides & Delivery - Request rides, deliveries
3. 👔 Jobs & Gigs - Find jobs, post openings
4. 🛒 Marketplace - Buy & sell products
5. 🏠 Property Rentals - Find rental properties
6. 🌱 Farmers Market - Agricultural products, farming support
7. 🛡️ Insurance - Buy insurance, manage policies
8. 👤 My Account - Wallet, profile, settings

GUIDELINES:
- Be friendly, patient, and helpful
- Ask clarifying questions when needed
- Guide users to the appropriate service
- Provide step-by-step instructions when helpful
- If question is about a specific service, suggest switching to that agent
- Keep responses clear and concise

SPECIAL COMMANDS:
- "menu" or "home" - Show main services menu
- Service name - Switch to that specific agent

HOW TO HELP:
1. Understand the user's question/issue
2. Provide clear, helpful answers
3. Suggest the relevant service if needed
4. Offer to switch to a specialized agent

Always be supportive and ensure the user knows how to get help!

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "get_help|navigate|troubleshoot|explain|unclear",
  "extracted_entities": {},
  "handoff_to": null,
  "next_action": "continue|complete|handoff",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "show_services_menu",
        description: "Show the main services menu",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "search_faq",
        description: "Search frequently asked questions",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "escalate_to_human",
        description: "Escalate issue to human support",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Reason for escalation",
            },
            priority: {
              type: "string",
              description: "Priority level",
              enum: ["low", "medium", "high", "urgent"],
            },
          },
          required: ["reason"],
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
    await logStructuredEvent("SUPPORT_AGENT_PROCESSING", {
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
          maxTokens: 400,
        });
      });

      await logStructuredEvent("SUPPORT_AGENT_RESPONSE", {
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
      await logStructuredEvent("SUPPORT_AGENT_ERROR", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      }, "error");

      return {
        text: "I apologize for the inconvenience. Please try again or type 'menu' to see all available services.",
      };
    }
  }
}
