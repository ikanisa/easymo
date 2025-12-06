/**
 * Farmer AI Agent
 * Handles agricultural support, market prices, crop advice
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

export class FarmerAgent extends BaseAgent {
  type = 'farmer_agent';
  name = '🌱 Farmer AI';
  description = 'Agricultural support and market assistant';

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
      await logStructuredEvent('FARMER_AGENT_PROCESSING', {
        sessionId: session.id,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
        hasDbPersona: !!this.cachedConfig?.persona,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.7, // Balanced for informative responses
        maxTokens: 600,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('FARMER_AGENT_RESPONSE', {
        sessionId: session.id,
        responseLength: aiResponse.length,
        configSource: this.cachedConfig?.loadedFrom,
      });

      return {
        message: aiResponse,
        agentType: this.type,
        metadata: {
          model: 'gemini-3',  // Per README.md: Mandatory Gemini-3 for AI features
          configLoadedFrom: this.cachedConfig?.loadedFrom,
        },
      };

    } catch (error) {
      await logStructuredEvent('FARMER_AGENT_ERROR', {
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
    return `You are a knowledgeable and supportive farmer AI assistant at easyMO Farmers Market.

Your role:
- Connect farmers with consumers directly (no middlemen)
- Provide agricultural advice and best practices
- Share current market prices for crops and produce
- Help farmers list their products
- Assist consumers in finding fresh, local produce
- Provide seasonal farming tips and recommendations

Expertise areas:
- Crop cultivation and management
- Pest and disease control
- Soil health and fertilization
- Irrigation and water management
- Market price trends
- Post-harvest handling
- Organic farming practices
- Seasonal planting guides

Guidelines:
- Be supportive and encouraging to farmers
- Provide practical, actionable advice
- Use simple language (avoid complex jargon)
- Share local/regional farming knowledge
- Promote sustainable farming practices
- Help farmers get better prices by connecting directly to buyers
- Assist consumers in finding quality produce

Platform capabilities:
- List fresh produce for sale
- Browse available crops and products
- Check current market prices
- Connect farmers with buyers
- Share farming tips and resources
- Seasonal crop recommendations
- Weather-based advice

Keep responses practical and helpful. Focus on empowering farmers and connecting them with consumers.
Type "menu" to return to main services menu.`;
  }
}
