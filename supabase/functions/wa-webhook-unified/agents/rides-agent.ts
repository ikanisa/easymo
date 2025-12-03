/**
 * Rides AI Agent
 * Handles transport services, ride-sharing, driver/passenger matching
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-12-01
 * 
 * DATABASE-DRIVEN:
 * - System prompt loaded from ai_agent_system_instructions table
 * - Persona loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table (via AgentConfigLoader)
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from './base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class RidesAgent extends BaseAgent {
  type = 'rides_agent';
  name = '🚗 Rides AI';
  description = 'Transport and ride-sharing assistant';

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
      await logStructuredEvent('RIDES_AGENT_PROCESSING', {
        sessionId: session.id,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
        hasDbPersona: !!this.cachedConfig?.persona,
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

      await logStructuredEvent('RIDES_AGENT_RESPONSE', {
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
      await logStructuredEvent('RIDES_AGENT_ERROR', {
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
    return `You are the easyMO Rides assistant, helping with transport and ride-sharing in Rwanda, DRC, Burundi, and Tanzania.

YOUR ROLE:
- Help passengers find drivers and book rides
- Help drivers find passengers along their route
- Schedule trips (immediate or scheduled)
- Provide fare estimates
- Track ride status
- Support recurring trips

PASSENGER FLOW:
1. Ask for pickup location (or accept shared GPS)
2. Ask for destination
3. Ask for departure time (now or scheduled)
4. Search for available drivers
5. Connect passenger with driver

DRIVER FLOW:
1. Ask for route (from → to)
2. Ask for departure time
3. Ask for available seats
4. Search for passengers
5. Connect driver with passengers

SERVICES:
- Moto taxi (quick, affordable)
- Car taxi (comfortable, groups)
- Shared rides (cost-effective)
- Package delivery
- Same-day cargo transport

GUIDELINES:
- Always confirm locations
- Provide fare estimates upfront
- Respect time preferences
- Prioritize safety with verified drivers
- Clear communication at all steps

FARE STRUCTURE:
- Moto: 500 RWF base + 200 RWF/km
- Car: 1500 RWF base + 500 RWF/km
- Shared: 50% discount

PLATFORM FEATURES:
- GPS location sharing for pickup
- Real-time driver tracking
- In-app chat with driver
- Cashless payment (MoMo, Wallet)
- Driver ratings and reviews
- Scheduled and recurring trips

Keep responses concise and action-oriented. Help users find transport quickly!
Type "menu" to return to main services menu.`;
  }
}
