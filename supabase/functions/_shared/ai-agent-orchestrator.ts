/**
 * AI Agent Orchestrator for WhatsApp Webhook Processing
 * 
 * Provides centralized AI agent management with:
 * - Context persistence and retrieval
 * - Token limit management and truncation
 * - Retry logic with exponential backoff
 * - Session tracking and metrics
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, logError, recordMetric } from "./observability.ts";

export interface AgentConfig {
  type: 'waiter' | 'real_estate' | 'job_board' | 'mobility' | 'marketplace' | 'wallet';
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  maxContextMessages?: number;
}

export interface ConversationContext {
  messages: Array<{ role: string; content: string; timestamp?: string }>;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  response: string;
  metadata: {
    correlationId: string;
    tokensUsed?: number;
    model?: string;
  };
}

export class AIAgentOrchestrator {
  private supabase: SupabaseClient;
  private correlationId: string;
  
  constructor(supabaseClient: SupabaseClient, correlationId: string) {
    this.supabase = supabaseClient;
    this.correlationId = correlationId;
  }

  /**
   * Process a message through the AI agent pipeline
   */
  async processMessage(
    conversationId: string,
    message: string,
    agentType: string
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      logStructuredEvent("AI_AGENT_PROCESSING_START", {
        conversationId,
        agentType,
        correlationId: this.correlationId,
      });

      // 1. Load conversation context
      const context = await this.loadContext(conversationId, agentType);
      
      // 2. Check token limits and truncate if needed
      const truncatedContext = await this.truncateContext(context);
      
      // 3. Get agent configuration
      const config = await this.getAgentConfig(agentType);
      
      // 4. Call AI service with retry logic
      const response = await this.callAIWithRetry(
        message,
        truncatedContext,
        config
      );
      
      // 5. Store updated context
      await this.saveContext(conversationId, agentType, {
        ...truncatedContext,
        messages: [
          ...truncatedContext.messages,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: response, timestamp: new Date().toISOString() }
        ]
      });
      
      // 6. Update session metrics
      await this.updateSessionMetrics(conversationId, agentType);
      
      const duration = Date.now() - startTime;
      
      logStructuredEvent("AI_AGENT_PROCESSING_COMPLETE", {
        conversationId,
        agentType,
        correlationId: this.correlationId,
        durationMs: duration,
      });
      
      recordMetric("ai_agent.message_processed", 1, {
        agent_type: agentType,
        duration_ms: duration,
      });
      
      return {
        response,
        metadata: {
          correlationId: this.correlationId,
        }
      };
      
    } catch (error) {
      logError("ai_agent_processing", error, {
        conversationId,
        agentType,
        correlationId: this.correlationId,
      });
      
      recordMetric("ai_agent.processing_error", 1, {
        agent_type: agentType,
      });
      
      throw error;
    }
  }

  /**
   * Load conversation context from database
   */
  private async loadContext(
    conversationId: string,
    agentType: string
  ): Promise<ConversationContext> {
    try {
      const { data, error } = await this.supabase
        .from('agent_contexts')
        .select('context_data')
        .eq('conversation_id', conversationId)
        .eq('agent_type', agentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }
      
      return (data?.context_data as ConversationContext) || { messages: [] };
      
    } catch (error) {
      logError("load_context", error, {
        conversationId,
        agentType,
        correlationId: this.correlationId,
      });
      
      // Return empty context on error rather than failing
      return { messages: [] };
    }
  }

  /**
   * Truncate context to fit within token limits
   * Uses a sliding window approach to keep recent messages
   */
  private async truncateContext(
    context: ConversationContext,
    maxTokens = 4000
  ): Promise<ConversationContext> {
    const messages = context.messages || [];
    
    // If no messages, return as-is
    if (messages.length === 0) {
      return context;
    }
    
    let tokenCount = 0;
    const truncated: typeof messages = [];
    
    // Process from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(messages[i].content);
      
      if (tokenCount + msgTokens > maxTokens) {
        logStructuredEvent("AI_CONTEXT_TRUNCATED", {
          originalMessageCount: messages.length,
          truncatedMessageCount: truncated.length,
          estimatedTokens: tokenCount,
          correlationId: this.correlationId,
        });
        break;
      }
      
      truncated.unshift(messages[i]);
      tokenCount += msgTokens;
    }
    
    return {
      ...context,
      messages: truncated,
    };
  }

  /**
   * Estimate token count for text
   * Rough estimation: 1 token ≈ 4 characters
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Call AI service with retry logic and exponential backoff
   */
  private async callAIWithRetry(
    message: string,
    context: ConversationContext,
    config: AgentConfig,
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.callAIService(message, context, config);
        
        if (attempt > 0) {
          recordMetric("ai_agent.retry_success", 1, {
            agent_type: config.type,
            attempt: attempt + 1,
          });
        }
        
        return response;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logStructuredEvent("AI_SERVICE_RETRY", {
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message,
          correlationId: this.correlationId,
        }, "warn");
        
        // Don't wait after last attempt
        if (attempt < maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    recordMetric("ai_agent.retry_exhausted", 1, {
      agent_type: config.type,
    });
    
    throw lastError || new Error('AI service call failed after retries');
  }

  /**
   * Call AI service (placeholder - implement with actual AI provider)
   */
  private async callAIService(
    message: string,
    context: ConversationContext,
    config: AgentConfig
  ): Promise<string> {
    // This is a placeholder implementation
    // Replace with actual AI service call (OpenAI, Anthropic, etc.)
    
    logStructuredEvent("AI_SERVICE_CALL", {
      agentType: config.type,
      messageLength: message.length,
      contextMessageCount: context.messages.length,
      correlationId: this.correlationId,
    });
    
    // TODO: Implement actual AI service integration
    // For now, return a placeholder response
    const placeholderResponse = `[AI Agent ${config.type}] Received: ${message.substring(0, 50)}...`;
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return placeholderResponse;
  }

  /**
   * Get agent configuration based on type
   */
  private async getAgentConfig(agentType: string): Promise<AgentConfig> {
    const configs: Record<string, AgentConfig> = {
      waiter: {
        type: 'waiter',
        maxTokens: 500,
        temperature: 0.7,
        systemPrompt: "You are a helpful waiter assistant. Help customers with menu items, orders, and restaurant information.",
        maxContextMessages: 20,
      },
      real_estate: {
        type: 'real_estate',
        maxTokens: 800,
        temperature: 0.5,
        systemPrompt: "You are a real estate agent. Help customers find properties, schedule viewings, and answer property-related questions.",
        maxContextMessages: 30,
      },
      job_board: {
        type: 'job_board',
        maxTokens: 600,
        temperature: 0.6,
        systemPrompt: "You are a job board assistant. Help users find jobs, prepare applications, and provide career advice.",
        maxContextMessages: 25,
      },
      mobility: {
        type: 'mobility',
        maxTokens: 400,
        temperature: 0.5,
        systemPrompt: "You are a mobility assistant. Help users find transportation options, drivers, and passengers.",
        maxContextMessages: 15,
      },
      marketplace: {
        type: 'marketplace',
        maxTokens: 500,
        temperature: 0.6,
        systemPrompt: "You are a marketplace assistant. Help users buy and sell items, find local businesses, and make transactions.",
        maxContextMessages: 20,
      },
      wallet: {
        type: 'wallet',
        maxTokens: 400,
        temperature: 0.3,
        systemPrompt: "You are a wallet assistant. Help users with mobile money transactions, balance inquiries, and payment history.",
        maxContextMessages: 15,
      },
    };
    
    const config = configs[agentType];
    
    if (!config) {
      logError("invalid_agent_type", new Error(`Unknown agent type: ${agentType}`), {
        agentType,
        correlationId: this.correlationId,
      });
      
      // Return default config
      return configs.waiter;
    }
    
    return config;
  }

  /**
   * Save updated context to database
   */
  private async saveContext(
    conversationId: string,
    agentType: string,
    context: ConversationContext
  ): Promise<void> {
    try {
      const tokenCount = this.estimateTokens(JSON.stringify(context));
      const messagesCount = context.messages.length;
      
      const { error } = await this.supabase
        .from('agent_contexts')
        .upsert({
          conversation_id: conversationId,
          agent_type: agentType,
          context_data: context,
          token_count: tokenCount,
          messages_count: messagesCount,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'conversation_id,agent_type',
        });
      
      if (error) {
        throw error;
      }
      
      logStructuredEvent("AI_CONTEXT_SAVED", {
        conversationId,
        agentType,
        messagesCount,
        tokenCount,
        correlationId: this.correlationId,
      });
      
    } catch (error) {
      logError("save_context", error, {
        conversationId,
        agentType,
        correlationId: this.correlationId,
      });
      
      // Don't throw - context save failure shouldn't break the flow
    }
  }

  /**
   * Update session metrics
   */
  private async updateSessionMetrics(
    conversationId: string,
    agentType: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('increment_session_metrics', {
          p_conversation_id: conversationId,
          p_agent_type: agentType,
        });
      
      if (error) {
        throw error;
      }
      
    } catch (error) {
      logError("update_session_metrics", error, {
        conversationId,
        agentType,
        correlationId: this.correlationId,
      });
      
      // Don't throw - metrics update failure shouldn't break the flow
    }
  }
}
