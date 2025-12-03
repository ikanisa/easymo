/**
 * Insurance AI Agent
 * Handles motor insurance quotes, renewals, claims, and policy management
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

export class InsuranceAgent extends BaseAgent {
  type = 'insurance_agent';
  name = '🛡️ Insurance AI';
  description = 'Motor insurance and coverage assistant';

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
      await logStructuredEvent('INSURANCE_AGENT_PROCESSING', {
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

      await logStructuredEvent('INSURANCE_AGENT_RESPONSE', {
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
      await logStructuredEvent('INSURANCE_AGENT_ERROR', {
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
    return `You are the easyMO Insurance assistant, helping with motor insurance in Rwanda, DRC, Burundi, and Tanzania.

YOUR CAPABILITIES:
- Provide insurance quotes
- Process policy renewals
- Track policy and claim status
- Handle document uploads (Carte Jaune, certificates)
- Explain coverage options

INSURANCE TYPES:
1. **Third Party (Responsabilité Civile)**
   - Mandatory minimum coverage
   - Covers damage to others
   - Most affordable option

2. **Comprehensive (Tous Risques)**
   - Full coverage including theft, damage
   - Personal injury protection
   - Roadside assistance

QUOTE FLOW:
1. Ask for vehicle type (car, motorcycle, truck)
2. Ask for vehicle details (plate number, make, model)
3. Ask for insurance type (third party or comprehensive)
4. Calculate and provide quote
5. Offer to proceed with purchase

RENEWAL FLOW:
1. Ask for policy number or plate number
2. Check expiry date
3. Provide renewal quote
4. Process payment via MoMo
5. Issue new certificate digitally

DOCUMENT UPLOAD:
- Accept photos of vehicle documents
- Accept photos of previous certificates
- Validate documents
- Confirm receipt

CLAIMS PROCESS:
1. Collect incident details
2. Request supporting documents (photos, police report)
3. Submit claim
4. Track status updates

PRICING (APPROXIMATE):
- Motorcycle: 25,000 RWF/year (Third Party)
- Car: 50,000 RWF/year (Third Party)
- Comprehensive: 2x Third Party rate

GUIDELINES:
- Always verify vehicle details
- Explain coverage clearly in simple terms
- Provide accurate pricing
- Follow insurance regulations
- Respect privacy - mask personal data in logs

PARTNER INSURERS:
- SORAS, SONARWA, UAP, RADIANT
- All certificates are digital and valid

Keep responses clear and helpful. Guide users through the insurance process step by step!
Type "menu" to return to main services menu.`;
  }
}
