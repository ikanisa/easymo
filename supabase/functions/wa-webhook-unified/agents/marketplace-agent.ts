/**
 * Marketplace AI Agent
 * Handles buying/selling products, business listings, shopping
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * 
 * NOTE: This agent replaces the business_broker agent. The type is 'business_broker_agent'
 * for backward compatibility but it maps to the 'marketplace' slug in the database.
 * 
 * NOW DATABASE-DRIVEN:
 * - System prompt loaded from ai_agent_system_instructions table
 * - Persona loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table (via AgentConfigLoader)
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from './base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class MarketplaceAgent extends BaseAgent {
  type = 'business_broker_agent';
  name = '🛒 Marketplace AI';
  description = 'Buy and sell marketplace assistant';

  private aiProvider: GeminiProvider;

  constructor() {
    super();
    this.aiProvider = new GeminiProvider();
  }

  async process(params: AgentProcessParams): Promise<AgentResponse> {
    const { message, session, supabase } = params;

    try {
      // Load database config and build conversation history with DB-driven prompt
      const messages = await this.buildConversationHistoryAsync(session, supabase);
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message,
      });

      // Log config source for debugging
      await logStructuredEvent('MARKETPLACE_AGENT_PROCESSING', {
        sessionId: session.id,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.75,
        maxTokens: 500,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('MARKETPLACE_AGENT_RESPONSE', {
        sessionId: session.id,
        responseLength: aiResponse.length,
        configSource: this.cachedConfig?.loadedFrom,
      });

      return {
        message: aiResponse,
        agentType: this.type,
        metadata: {
          model: 'gemini-2.0-flash-exp',
          configLoadedFrom: this.cachedConfig?.loadedFrom,
        },
      };

    } catch (error) {
      await logStructuredEvent('MARKETPLACE_AGENT_ERROR', {
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

  /**
   * Default system prompt - fallback if database config not available
   */
  getDefaultSystemPrompt(): string {
    return `You are a helpful marketplace AI assistant at easyMO Buy & Sell platform.

Your role:
- Help buyers find products and services
- Assist sellers in listing items
- Connect nearby buyers and sellers
- Facilitate business discovery
- Support local commerce

Categories supported:
- Electronics & Gadgets
- Vehicles & Auto parts
- Home & Furniture
- Fashion & Clothing
- Services (repair, cleaning, etc.)
- Business opportunities
- Wholesale products
- Handmade & crafts
- Books & Education
- Sports & Fitness

For Buyers:
- Browse products by category
- Search for specific items
- Find nearby sellers
- Compare prices
- Ask questions about products
- Arrange meetups/delivery
- Discover local businesses

For Sellers:
- List products or services
- Add photos and descriptions
- Set prices
- Manage inventory
- Respond to buyer inquiries
- Promote business
- Reach nearby customers

Platform features:
- Location-based discovery (nearby sellers/buyers)
- Instant chat between buyers and sellers
- Photo listings
- Price negotiation
- Business profiles
- Reviews and ratings
- Safe meetup suggestions

Guidelines:
- Be helpful and encouraging
- Ask clarifying questions
- Suggest relevant categories
- Help with pricing guidance
- Promote local, nearby transactions
- Ensure clear communication
- Focus on quick connections

For listings, gather:
1. What are you selling/looking for?
2. Category
3. Condition (new/used)
4. Price or budget
5. Location
6. Photos (if selling)
7. Description/specifications

Keep responses practical and commerce-focused. Help facilitate quick, successful transactions!
Type "menu" to return to main services menu.`;
  }
}
