/**
 * Marketplace AI Provider - Dual Provider Support for Buy & Sell Agent
 * 
 * Wraps LLMRouter to provide a simple chat interface for marketplace agent.
 * Supports both OpenAI and Gemini with intelligent failover.
 * 
 * This is the "DualAIProvider" that buy-sell agent needs.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { LLMRouter } from "../llm-router.ts";
import { logStructuredEvent, recordMetric } from "../observability.ts";
import type { LLMMessage } from "../llm-provider-interface.ts";

export interface MarketplaceAIChatOptions {
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

/**
 * DualAIProvider - Alias for backward compatibility
 * Marketplace agent uses this to access AI capabilities
 */
export class DualAIProvider {
  private router: LLMRouter;
  private correlationId?: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId;
    this.router = new LLMRouter({
      correlationId,
      enableFailover: true,
      maxRetries: 2,
    });

    logStructuredEvent("MARKETPLACE_AI_PROVIDER_INITIALIZED", {
      correlationId,
    });
  }

  /**
   * Send a chat completion request
   * Compatible with the old DualAIProvider interface
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: MarketplaceAIChatOptions
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Convert messages to LLM format
      const llmMessages: LLMMessage[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // Use router to execute with marketplace-agent config
      const response = await this.router.execute(
        'marketplace-agent', // Agent slug for config lookup
        {
          model: 'gemini-1.5-flash', // Default for marketplace
          messages: llmMessages,
          temperature: options?.temperature ?? 0.7,
          maxTokens: options?.maxTokens ?? 1024,
        },
        options?.metadata
      );

      const duration = Date.now() - startTime;
      
      recordMetric("marketplace.ai.chat.success", 1, {
        duration_ms: duration,
        provider: response.metadata.provider,
      });

      return response.content;

    } catch (error) {
      const duration = Date.now() - startTime;

      logStructuredEvent("MARKETPLACE_AI_CHAT_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
        correlationId: this.correlationId,
      }, "error");

      recordMetric("marketplace.ai.chat.error", 1);

      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.router.healthCheck();
      
      // Require at least one provider to be healthy
      return Object.values(health).some(h => h);
    } catch {
      return false;
    }
  }
}

/**
 * MarketplaceAIProvider - Modern alias
 */
export class MarketplaceAIProvider extends DualAIProvider {}

// Default export for convenience
export default DualAIProvider;
