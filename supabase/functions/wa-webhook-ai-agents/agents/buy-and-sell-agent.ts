/**
 * Buy & Sell AI Agent
 * 
 * Unified commerce and business discovery agent that consolidates:
 * - Marketplace Agent (pharmacy, hardware, grocery commerce)
 * - Business Broker Agent (business sales, acquisitions, legal intake)
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-12-05 (merged from marketplace-agent.ts)
 * 
 * NOW DATABASE-DRIVEN:
 * - System prompt loaded from ai_agent_system_instructions table
 * - Persona loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table (via AgentConfigLoader)
 */

import { BaseAgent, type AgentProcessParams, type AgentResponse } from '../core/base-agent.ts';
import { GeminiProvider } from '../core/providers/gemini.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export class BuyAndSellAgent extends BaseAgent {
  type = 'buy_and_sell_agent';
  name = '🛒 Buy & Sell AI';
  description = 'Unified commerce and business discovery assistant';

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
      await logStructuredEvent('BUY_AND_SELL_AGENT_PROCESSING', {
        sessionId: session.id,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
        toolsAvailable: this.cachedConfig?.tools.length || 0,
      });

      // Generate AI response
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.6,
        maxTokens: 600,
      });

      // Update conversation history
      await this.updateConversationHistory(session, message, aiResponse, supabase);

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
      });

      await logStructuredEvent('BUY_AND_SELL_AGENT_RESPONSE', {
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
      await logStructuredEvent('BUY_AND_SELL_AGENT_ERROR', {
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
    return `You are EasyMO's unified Buy & Sell assistant, helping users with marketplace transactions and business opportunities.

MARKETPLACE CAPABILITIES:
- Help users buy and sell products across all retail categories (pharmacy, hardware, grocery)
- Find shops and stores nearby
- Create and manage product listings
- Search for specific items
- Handle OTC pharmacy products; for RX items, request photo and escalate to pharmacist
- No medical advice, dosing, or contraindication information

BUSINESS DISCOVERY:
- Map user needs → business categories → specific nearby businesses
- Use maps_geocode for location-based search
- Return ranked list with reasons (open now, distance, rating)
- Only recommend businesses from the database; respect opening hours

BUSINESS BROKERAGE:
- For sellers: Collect business details, financials (sanitized), asking price, terms
- For buyers: Understand acquisition criteria, budget, industry preferences
- Match parties; facilitate introductions; schedule meetings
- Generate NDAs and LOIs via generate_pdf when parties proceed

LEGAL INTAKE (handoff required):
- Triage case category (business, contract, IP, employment, etc.)
- Collect facts: who/what/when/where and desired outcome
- Prepare scope summary; generate engagement letter PDF
- Take retainer via momo_charge; open case file
- All substantive matters require human associate review

GUARDRAILS:
- No medical advice beyond finding a pharmacy
- No legal, tax, or financial advice—only logistics and intake
- Protect user privacy and confidentiality
- Sensitive topics require handoff to staff

FLOW:
1) Identify intent: product search, business discovery, business sale/purchase, or legal intake
2) For products: search_supabase/inventory_check; present options; build basket
3) For business discovery: maps_geocode + search_businesses; present ranked options
4) For business transactions: collect details; match parties; generate documents
5) For all orders: momo_charge; confirm after settlement; track via order_status_update
6) Notify fulfillment (notify_staff); escalate sensitive topics immediately

Type "menu" to return to main services menu.`;
  }
}

/**
 * @deprecated Use BuyAndSellAgent instead. MarketplaceAgent has been merged into BuyAndSellAgent.
 */
export const MarketplaceAgent = BuyAndSellAgent;
