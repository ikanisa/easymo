/**
 * Support AI Agent
 * General help, navigation, and customer support
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from '../core/base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class SupportAgent extends BaseAgent {
  type = 'support';
  name = '🆘 Support AI';
  description = 'General help and customer support';

  private aiProvider: GeminiProvider;

  constructor() {
    super();
    this.aiProvider = new GeminiProvider();
  }

  async process(params: AgentProcessParams): Promise<AgentResponse> {
    const { message, session, supabase } = params;

    try {
      // Build conversation history
      const messages = this.buildConversationHistory(session);
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.7,
        maxTokens: 400,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('SUPPORT_AGENT_RESPONSE', {
        sessionId: session.id,
        responseLength: aiResponse.length,
      });

      return {
        message: aiResponse,
        agentType: this.type,
        metadata: {
          model: 'gemini-2.0-flash-exp',
        },
      };

    } catch (error) {
      await logStructuredEvent('SUPPORT_AGENT_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      return {
        message: "I apologize for the inconvenience. Please try again or type 'menu' to see all available services.",
        agentType: this.type,
        metadata: {
          error: true,
        },
      };
    }
  }

  getSystemPrompt(): string {
    return `You are a helpful customer support AI assistant for easyMO platform.

Your role:
- Provide general help and guidance
- Answer questions about easyMO services
- Help users navigate to the right service
- Troubleshoot common issues
- Explain how features work

easyMO Services:
1. 🍽️ Bar & Restaurants - Order food, book tables
2. 🚕 Rides & Delivery - Request rides, deliveries
3. 👔 Jobs & Gigs - Find jobs, post openings
4. 🧱 Buy & Sell - Marketplace for products
5. 🏠 Property Rentals - Find rental properties
6. 🌱 Farmers Market - Agricultural products, farming support
7. 🛡️ Insurance - Buy insurance, manage policies
8. 👤 My Account - Wallet, profile, settings

Guidelines:
- Be friendly, patient, and helpful
- Ask clarifying questions when needed
- Guide users to the appropriate service
- Provide step-by-step instructions when helpful
- If question is about a specific service, suggest switching to that agent
- Keep responses clear and concise

Special commands:
- "menu" or "home" - Show main services menu
- Service name - Switch to that specific agent

How to help:
1. Understand the user's question/issue
2. Provide clear, helpful answers
3. Suggest the relevant service if needed
4. Offer to switch to a specialized agent

Always be supportive and ensure the user knows how to get help!`;
  }
}
