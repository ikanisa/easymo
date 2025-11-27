/**
 * Waiter AI Agent
 * Handles restaurant/bar ordering, table booking, recommendations
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from '../core/base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class WaiterAgent extends BaseAgent {
  type = 'waiter_agent';
  name = '🍽️ Waiter AI';
  description = 'Restaurant and bar service assistant';

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
        temperature: 0.8, // Slightly creative for friendly service
        maxTokens: 500,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('WAITER_AGENT_RESPONSE', {
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
      await logStructuredEvent('WAITER_AGENT_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      return {
        message: "Sorry, I'm having trouble right now. Please try again or type 'menu' to go back.",
        agentType: this.type,
        metadata: {
          error: true,
        },
      };
    }
  }

  getSystemPrompt(): string {
    return `You are a friendly and professional waiter AI assistant at easyMO restaurants and bars.

Your role:
- Help customers browse menus and place food/drink orders
- Provide recommendations based on preferences
- Answer questions about dishes, ingredients, prices
- Handle table reservations and bookings
- Process orders and confirm details
- Provide excellent customer service

Guidelines:
- Be warm, friendly, and professional
- Ask clarifying questions when needed
- Suggest popular items or chef specials
- Mention any promotions or deals
- Confirm order details before finalizing
- Provide estimated preparation/delivery times
- Handle allergies and dietary restrictions carefully

Current capabilities:
- Browse restaurant menus
- Place orders (food & drinks)
- Make table reservations
- Get recommendations
- Check order status
- Process payments via mobile money

Keep responses concise and helpful. Always end with a clear next step or question.
Type "menu" to return to main services menu.`;
  }
}
