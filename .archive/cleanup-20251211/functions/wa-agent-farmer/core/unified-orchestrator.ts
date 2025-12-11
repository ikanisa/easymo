/**
 * Unified AI Agent Orchestrator
 * Single source of truth for all AI agent interactions
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AgentRegistry } from './agent-registry.ts';
import { GeminiProvider } from './providers/gemini.ts';
import { SessionManager } from './session-manager.ts';
import type { BaseAgent, AgentResponse } from './base-agent.ts';
import { logStructuredEvent } from '../../_shared/observability.ts';

export interface ProcessMessageParams {
  phone: string;
  message: string;
  agentType?: string; // Optional - from menu selection
  context?: Record<string, any>;
}

export class UnifiedOrchestrator {
  private registry: AgentRegistry;
  private aiProvider: GeminiProvider;
  private sessionManager: SessionManager;

  constructor(private supabase: SupabaseClient) {
    this.registry = new AgentRegistry();
    this.aiProvider = new GeminiProvider();
    this.sessionManager = new SessionManager(supabase);
  }

  /**
   * Main entry point - processes any message
   */
  async processMessage(params: ProcessMessageParams): Promise<AgentResponse> {
    const { phone, message, agentType, context } = params;
    const startTime = performance.now();

    try {
      // 1. Get or create session
      const session = await this.sessionManager.getOrCreate(phone);

      await logStructuredEvent('ORCHESTRATOR_SESSION_LOADED', {
        sessionId: session.id,
        phone: phone.slice(-4), // Last 4 digits only
        hasContext: !!session.context,
      });

      // 2. Determine which agent to use
      const agent = agentType
        ? this.registry.getAgent(agentType)
        : await this.determineAgent(message, session);

      await logStructuredEvent('ORCHESTRATOR_AGENT_SELECTED', {
        agentType: agent.type,
        agentName: agent.name,
        selectionMethod: agentType ? 'explicit' : 'inferred',
      });

      // 3. Update session with current agent
      await this.sessionManager.setCurrentAgent(session.id, agent.type);

      // 4. Merge additional context if provided
      if (context) {
        await this.sessionManager.updateContext(session.id, {
          ...session.context,
          ...context,
        });
      }

      // 5. Process with selected agent
      const response = await agent.process({
        message,
        session,
        supabase: this.supabase,
      });

      // 6. Log successful interaction
      const duration = performance.now() - startTime;
      await logStructuredEvent('ORCHESTRATOR_SUCCESS', {
        agentType: agent.type,
        durationMs: Math.round(duration),
        responseLength: response.message.length,
      });

      return response;

    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logStructuredEvent('ORCHESTRATOR_ERROR', {
        error: errorMessage,
        durationMs: Math.round(duration),
        phone: phone.slice(-4),
      }, 'error');

      // Return graceful error response
      return {
        message: "I'm having trouble processing your request right now. Please try again or type 'menu' to go back to the main menu.",
        agentType: 'error',
        metadata: {
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Intelligently determines which agent should handle the message
   */
  private async determineAgent(
    message: string,
    session: any
  ): Promise<BaseAgent> {
    // Check if user has active agent in session
    if (session.context?.currentAgent) {
      const activeAgent = this.registry.getAgent(session.context.currentAgent);
      
      // Check if user wants to exit current agent
      const exitKeywords = ['menu', 'home', 'exit', 'back', 'cancel'];
      const normalized = message.trim().toLowerCase();
      
      if (exitKeywords.includes(normalized)) {
        // User wants to exit, clear agent and show menu
        await this.sessionManager.clearCurrentAgent(session.id);
        return this.registry.getAgent('sales_agent'); // Support agent handles menu
      }

      // Continue with current agent
      return activeAgent;
    }

    // No active agent - classify intent using AI
    try {
      const intent = await this.classifyIntent(message);
      return this.registry.getAgentByIntent(intent);
    } catch (error) {
      // Fallback to support agent if classification fails
      await logStructuredEvent('INTENT_CLASSIFICATION_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warn');
      
      return this.registry.getAgent('sales_agent');
    }
  }

  /**
   * Use AI to classify user intent
   */
  private async classifyIntent(message: string): Promise<string> {
    const prompt = `Classify the user's intent from this message into ONE category:
- waiter (food, restaurant, ordering, bar, drinks, menu)
- farmer (crops, agriculture, market prices, farming, harvest)
- jobs (employment, hiring, career, work, job search)
- property (rental, housing, real estate, apartment, house)
- marketplace (buy, sell, shopping, products, business)
- support (help, questions, issues, general inquiries)

Message: "${message}"

Reply with ONLY the category name (lowercase, no punctuation).`;

    try {
      const result = await this.aiProvider.chat([
        { role: 'user', content: prompt },
      ], {
        temperature: 0.3, // Lower temperature for more consistent classification
        maxTokens: 50,
      });

      const intent = result.trim().toLowerCase().replace(/[^a-z]/g, '');
      
      await logStructuredEvent('INTENT_CLASSIFIED', {
        message: message.slice(0, 50),
        intent,
      });

      return intent;
    } catch (error) {
      throw new Error(`Intent classification failed: ${error}`);
    }
  }

  /**
   * Get AI provider (for agents that need direct access)
   */
  getAIProvider(): GeminiProvider {
    return this.aiProvider;
  }

  /**
   * Get agent registry (for testing/admin)
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}
