/**
 * Sales Agent (Consolidated)
 * 
 * Sales and customer management assistant.
 * Updated to use AIProviderFactory for dual provider support.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";
import { AIProviderFactory, type Message } from "../core/providers/index.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export class SalesAgent extends BaseAgent {
  get type(): AgentType {
    return "sales_cold_caller";
  }

  get keywords(): string[] {
    return [
      "sales", "sell", "selling", "customer", "client", "deal", "offer",
      "discount", "price", "quote", "proposal", "lead", "prospect",
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Sales Agent, helping with sales and customer management.

YOUR CAPABILITIES:
- Track sales opportunities and leads
- Manage customer relationships
- Create quotes and proposals
- Track deal pipeline stages
- Provide sales advice and strategies
- Follow up with prospects

SALES PROCESS:
1. Lead identification and qualification
2. Initial contact and needs assessment
3. Proposal/quote creation
4. Negotiation and objection handling
5. Closing and follow-up

GUIDELINES:
- Be professional and results-oriented
- Focus on customer needs and value
- Provide clear pricing and terms
- Track all interactions for follow-up
- Build long-term relationships
- Be persistent but respectful

CRM FEATURES:
- Lead tracking and scoring
- Deal pipeline management
- Customer interaction history
- Quote generation
- Follow-up reminders
- Performance analytics

Keep responses professional and action-oriented. Help users close more deals!
Type "menu" to return to main services menu.

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "create_quote|track_deal|manage_customer|follow_up|sales_advice|unclear",
  "extracted_entities": {},
  "next_action": "continue|complete|handoff",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "create_lead",
        description: "Create a new sales lead",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Lead/prospect name",
            },
            phone: {
              type: "string",
              description: "Contact phone number",
            },
            interest: {
              type: "string",
              description: "Product/service of interest",
            },
            notes: {
              type: "string",
              description: "Additional notes",
            },
          },
          required: ["name", "interest"],
        },
      },
      {
        name: "create_quote",
        description: "Create a sales quote",
        parameters: {
          type: "object",
          properties: {
            leadId: {
              type: "string",
              description: "Lead identifier",
            },
            items: {
              type: "string",
              description: "JSON array of quote items",
            },
            discount: {
              type: "number",
              description: "Discount percentage",
            },
            validDays: {
              type: "number",
              description: "Quote validity in days",
            },
          },
          required: ["leadId", "items"],
        },
      },
      {
        name: "update_deal_stage",
        description: "Update deal pipeline stage",
        parameters: {
          type: "object",
          properties: {
            dealId: {
              type: "string",
              description: "Deal identifier",
            },
            stage: {
              type: "string",
              description: "New pipeline stage",
              enum: ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"],
            },
            notes: {
              type: "string",
              description: "Stage update notes",
            },
          },
          required: ["dealId", "stage"],
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
    await logStructuredEvent("SALES_AGENT_PROCESSING", {
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
          maxTokens: 500,
        });
      });

      await logStructuredEvent("SALES_AGENT_RESPONSE", {
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
      await logStructuredEvent("SALES_AGENT_ERROR", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      }, "error");

      return {
        text: "Sorry, I'm having trouble right now. Please try again or type 'menu' to go back.",
      };
    }
  }
}
