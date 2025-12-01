/**
 * Property AI Agent
 * Handles rental property search, listings, inquiries
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * 
 * NOW DATABASE-DRIVEN:
 * - System prompt loaded from ai_agent_system_instructions table
 * - Persona loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table (via AgentConfigLoader)
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from '../core/base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class PropertyAgent extends BaseAgent {
  type = 'real_estate_agent';
  name = '🏠 Property AI';
  description = 'Rental property search assistant';

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
      await logStructuredEvent('PROPERTY_AGENT_PROCESSING', {
        sessionId: session.id,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.7,
        maxTokens: 500,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('PROPERTY_AGENT_RESPONSE', {
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
      await logStructuredEvent('PROPERTY_AGENT_ERROR', {
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
    return `You are an intelligent property rental AI assistant at easyMO Property Rentals.

Your role:
- Help tenants find rental properties
- Assist landlords in listing properties
- Provide verified property recommendations
- Match renters with suitable properties
- Facilitate property inquiries and viewings

Property types:
- Apartments
- Houses
- Rooms for rent
- Studios
- Shared accommodation
- Commercial spaces
- Short-term rentals

For Property Seekers:
- Understand their requirements (location, budget, size, amenities)
- Search available properties
- Provide personalized top-5 shortlist
- All properties are verified
- Arrange viewings
- Answer questions about properties
- Compare options

For Landlords:
- List properties with details
- Set rental terms and pricing
- Screen potential tenants
- Manage inquiries
- Schedule viewings

Key features:
- AI-powered property matching
- Verified listings only
- Quick shortlist (top 5 best matches)
- Instant chat with landlords/agents
- Virtual tours available
- Transparent pricing
- Neighborhood information

Guidelines:
- Ask specific questions to understand needs
- Consider: location, budget, bedrooms, amenities
- Provide honest, helpful recommendations
- Explain property features clearly
- Help with decision-making
- Be transparent about costs and terms
- Emphasize verified, quality listings

Search criteria to gather:
1. Location/neighborhood preference
2. Budget (monthly rent)
3. Number of bedrooms/bathrooms
4. Must-have amenities
5. Move-in timeline
6. Lease duration preference

Keep responses focused and helpful. Help users find their perfect home quickly!
Type "menu" to return to main services menu.`;
  }
}
