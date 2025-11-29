/**
 * AgentOrchestrator - Central coordinator for AI Agent System
 * 
 * This class manages all agent interactions, routing, memory, and tool execution.
 * It's the single entry point for processing user messages.
 * 
 * @packageDocumentation
 */

import { childLogger } from '@easymo/commons';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import OpenAI from 'openai';

const log = childLogger({ service: 'ai' });

import type {
  AgentConfig,
  AgentResponse,
  Conversation,
  ExecutionParams,
  MemoryEntry,
  Message,
  OrchestratorConfig,
  ProcessMessageParams,
  TokenUsage,
  Tool,
  ToolCall,
} from './types';

export class AgentOrchestrator {
  private openai: OpenAI;
  private redis: Redis;
  private supabase: SupabaseClient;
  private agentCache: Map<string, AgentConfig> = new Map();
  private toolCache: Map<string, Tool> = new Map();

  constructor(config: OrchestratorConfig) {
    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: config.openaiKey,
      maxRetries: 3,
      timeout: 60000, // 60 seconds
    });

    // Initialize Redis
    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000);
      },
    });

    // Initialize Supabase
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Main entry point - process a user message
   */
  async processMessage(params: ProcessMessageParams): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // 1. Get or create conversation
      const conversation = await this.getOrCreateConversation(params);

      // 2. Classify intent and select agent if needed
      if (!conversation.agent_id) {
        const agent = await this.classifyIntent(params.message, params.context);
        conversation.agent_id = agent.id;
        await this.updateConversation(conversation);
      }

      // 3. Load agent configuration
      const agent = await this.loadAgent(conversation.agent_id);

      // 4. Retrieve relevant memory
      const memory = await this.retrieveMemory(
        conversation.id,
        params.message
      );

      // 5. Execute agent with tools
      const response = await this.executeAgent(agent, {
        conversation,
        message: params.message,
        memory,
        context: params.context,
      });

      // 6. Save to memory
      await this.saveToMemory(conversation, params.message, response.message);

      // 7. Track metrics
      await this.trackMetrics(conversation, response, startTime);

      return response;
    } catch (error) {
      log.error('[AgentOrchestrator] Error processing message:', error);
      throw error;
    }
  }

  /**
   * Get or create conversation
   */
  private async getOrCreateConversation(
    params: ProcessMessageParams
  ): Promise<Conversation> {
    // Check if conversation ID provided
    if (params.conversationId) {
      const { data: existing } = await this.supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', params.conversationId)
        .single();

      if (existing) {
        return existing as Conversation;
      }
    }

    // Check for active conversation by user_id
    const { data: active } = await this.supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', params.userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (active) {
      return active as Conversation;
    }

    // Create new conversation
    const { data: newConv, error } = await this.supabase
      .from('ai_conversations')
      .insert({
        user_id: params.userId,
        channel: 'whatsapp',
        status: 'active',
        context: params.context || {},
        started_at: new Date().toISOString(),
        total_cost_usd: 0,
        total_tokens: 0,
        message_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return newConv as Conversation;
  }

  /**
   * Classify intent and select appropriate agent
   */
  private async classifyIntent(
    message: string,
    context?: Record<string, any>
  ): Promise<AgentConfig> {
    // Use GPT-4o-mini for fast, cheap classification
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify this user message into one of these agent types:
- booking: Booking bar-truck slots, reservations, availability
- payment: Wallet balance, payments, transactions
- support: Help, questions, issues, complaints
- driver: Driver-related queries
- shop: Shop/business queries
- general: Everything else

Context: ${JSON.stringify(context || {})}

Respond with ONLY the agent type, nothing else.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.3,
      max_tokens: 20,
    });

    const agentType =
      response.choices[0].message.content?.trim().toLowerCase() || 'general';

    // Load agent by type
    return await this.loadAgentByType(agentType);
  }

  /**
   * Load agent configuration from database (with caching)
   */
  private async loadAgent(agentId: string): Promise<AgentConfig> {
    // Check cache
    if (this.agentCache.has(agentId)) {
      return this.agentCache.get(agentId)!;
    }

    // Load from database
    const { data, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const agent: AgentConfig = {
      id: data.id,
      name: data.name,
      type: data.type,
      description: data.description,
      instructions: data.instructions,
      model: data.model,
      temperature: parseFloat(data.temperature),
      maxTokens: data.max_tokens,
      tools: data.tools || [],
      enabled: data.enabled,
      metadata: data.metadata || {},
    };

    // Cache it
    this.agentCache.set(agentId, agent);

    return agent;
  }

  /**
   * Load agent by type
   */
  private async loadAgentByType(type: string): Promise<AgentConfig> {
    const { data, error } = await this.supabase
      .from('ai_agents')
      .select('*')
      .eq('type', type)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      // Fallback to triage agent
      const { data: fallback } = await this.supabase
        .from('ai_agents')
        .select('*')
        .eq('type', 'triage')
        .eq('enabled', true)
        .single();

      if (!fallback) {
        throw new Error('No agents available');
      }

      return this.loadAgent(fallback.id);
    }

    return this.loadAgent(data.id);
  }

  /**
   * Execute agent with full context
   */
  private async executeAgent(
    agent: AgentConfig,
    params: ExecutionParams
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    // Build messages array
    const messages = await this.buildMessages(agent, params);

    // Get available tools
    const tools = await this.loadTools(agent.tools);

    // Execute with OpenAI
    const response = await this.openai.chat.completions.create({
      model: agent.model,
      messages,
      tools: tools.length > 0 ? this.formatTools(tools) : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
      user: params.conversation.user_id,
    });

    const choice = response.choices[0];
    const message = choice.message;

    // Calculate cost
    const cost = this.calculateCost(
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
      agent.model
    );

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      return await this.handleToolCalls(
        message.tool_calls,
        tools,
        agent,
        params,
        messages,
        response.usage
      );
    }

    const latency = Date.now() - startTime;

    return {
      message: message.content || '',
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
      cost,
      latency,
      model: agent.model,
    };
  }

  /**
   * Build messages array for OpenAI
   */
  private async buildMessages(
    agent: AgentConfig,
    params: ExecutionParams
  ): Promise<any[]> {
    const messages: any[] = [];

    // System prompt
    messages.push({
      role: 'system',
      content: agent.instructions,
    });

    // Add memory context if available
    if (params.memory.length > 0) {
      messages.push({
        role: 'system',
        content: `Relevant context from past conversations:\n${params.memory.join('\n')}`,
      });
    }

    // Get recent conversation history from Redis
    const history = await this.getConversationHistory(
      params.conversation.id,
      20
    );

    // Add history
    messages.push(...history);

    // Add current message
    messages.push({
      role: 'user',
      content: params.message,
    });

    return messages;
  }

  /**
   * Handle tool calls and continue conversation
   */
  private async handleToolCalls(
    toolCalls: any[],
    tools: Tool[],
    agent: AgentConfig,
    params: ExecutionParams,
    previousMessages: any[],
    previousUsage?: any
  ): Promise<AgentResponse> {
    const toolResults: any[] = [];
    const executedTools: string[] = [];

    // Execute each tool
    for (const toolCall of toolCalls) {
      try {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        if (!tool) {
          throw new Error(`Tool not found: ${toolCall.function.name}`);
        }

        const args = JSON.parse(toolCall.function.arguments);
        const startTime = Date.now();

        const result = await tool.execute(args, {
          conversationId: params.conversation.id,
          userId: params.conversation.user_id,
          profileId: params.conversation.profile_id,
          agentId: agent.id,
          supabase: this.supabase,
          variables: params.context,
        });

        const duration = Date.now() - startTime;

        // Log tool execution
        await this.logToolExecution(
          params.conversation.id,
          agent.id,
          tool.name,
          args,
          result,
          true,
          duration,
          params.conversation.user_id
        );

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result),
        });

        executedTools.push(tool.name);
      } catch (error: any) {
        log.error(`[AgentOrchestrator] Tool execution error:`, error);

        // Log failed execution
        await this.logToolExecution(
          params.conversation.id,
          agent.id,
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          null,
          false,
          0,
          params.conversation.user_id,
          error.message
        );

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify({ error: error.message }),
        });
      }
    }

    // Continue conversation with tool results
    const messages = [
      ...previousMessages,
      {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls,
      },
      ...toolResults,
    ];

    const finalResponse = await this.openai.chat.completions.create({
      model: agent.model,
      messages,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    });

    const finalChoice = finalResponse.choices[0];
    const totalUsage = previousUsage
      ? {
          prompt_tokens:
            previousUsage.prompt_tokens +
            (finalResponse.usage?.prompt_tokens || 0),
          completion_tokens:
            previousUsage.completion_tokens +
            (finalResponse.usage?.completion_tokens || 0),
          total_tokens:
            previousUsage.total_tokens +
            (finalResponse.usage?.total_tokens || 0),
        }
      : finalResponse.usage;

    const cost = this.calculateCost(
      totalUsage?.prompt_tokens || 0,
      totalUsage?.completion_tokens || 0,
      agent.model
    );

    return {
      message: finalChoice.message.content || '',
      usage: totalUsage
        ? {
            prompt_tokens: totalUsage.prompt_tokens,
            completion_tokens: totalUsage.completion_tokens,
            total_tokens: totalUsage.total_tokens,
          }
        : undefined,
      cost,
      toolsExecuted: executedTools,
      model: agent.model,
    };
  }

  /**
   * Load tools from database
   */
  private async loadTools(toolNames: string[]): Promise<Tool[]> {
    const tools: Tool[] = [];

    for (const name of toolNames) {
      // Check cache
      if (this.toolCache.has(name)) {
        tools.push(this.toolCache.get(name)!);
        continue;
      }

      // Load from database
      const { data } = await this.supabase
        .from('ai_tools')
        .select('*')
        .eq('name', name)
        .eq('enabled', true)
        .single();

      if (data) {
        // NOTE: Tool handler will be loaded dynamically
        // For now, we'll use a placeholder
        const tool: Tool = {
          name: data.name,
          description: data.description,
          category: data.category,
          parameters: data.parameters,
          enabled: data.enabled,
          requiresAuth: data.requires_auth,
          execute: async () => {
            throw new Error(
              `Tool handler not implemented for ${data.name}`
            );
          },
        };

        this.toolCache.set(name, tool);
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Format tools for OpenAI function calling
   */
  private formatTools(tools: Tool[]): any[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get conversation history from Redis
   */
  private async getConversationHistory(
    conversationId: string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const key = `conversation:${conversationId}:messages`;
      const messages = await this.redis.lrange(key, -limit, -1);
      return messages.map((msg) => JSON.parse(msg));
    } catch (error) {
      log.error('[AgentOrchestrator] Error loading history:', error);
      return [];
    }
  }

  /**
   * Retrieve relevant memory using embeddings
   */
  private async retrieveMemory(
    conversationId: string,
    query: string
  ): Promise<string[]> {
    try {
      // Generate embedding for query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Search similar embeddings in Supabase
      const { data, error } = await this.supabase.rpc('match_ai_embeddings', {
        query_embedding: queryEmbedding,
        match_count: 5,
        match_threshold: 0.7,
        filter_conversation_id: conversationId,
      });

      if (error) {
        log.error('[AgentOrchestrator] Memory retrieval error:', error);
        return [];
      }

      return (data as MemoryEntry[])?.map((entry) => entry.content) || [];
    } catch (error) {
      log.error('[AgentOrchestrator] Memory retrieval error:', error);
      return [];
    }
  }

  /**
   * Save conversation to memory
   */
  private async saveToMemory(
    conversation: Conversation,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      // Save to short-term memory (Redis)
      const key = `conversation:${conversation.id}:messages`;

      await this.redis.lpush(
        key,
        JSON.stringify({ role: 'user', content: userMessage }),
        JSON.stringify({ role: 'assistant', content: assistantMessage })
      );

      // Keep last 50 messages
      await this.redis.ltrim(key, -50, -1);

      // Expire after 30 days
      await this.redis.expire(key, 86400 * 30);

      // Save to long-term memory if important
      const importance = await this.assessImportance(
        userMessage,
        assistantMessage
      );

      if (importance > 0.7) {
        const content = `User: ${userMessage}\nAssistant: ${assistantMessage}`;

        // Generate embedding
        const embeddingResponse = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: content,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Save to Supabase
        await this.supabase.from('ai_embeddings').insert({
          conversation_id: conversation.id,
          content,
          embedding,
          importance_score: importance,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      log.error('[AgentOrchestrator] Error saving to memory:', error);
    }
  }

  /**
   * Assess importance of content for long-term memory
   */
  private async assessImportance(
    userMessage: string,
    assistantMessage: string
  ): Promise<number> {
    // Simple heuristic - can be enhanced with LLM
    const importantKeywords = [
      'important',
      'remember',
      'note',
      'booking',
      'payment',
      'confirmed',
      'cancelled',
    ];

    const combined = `${userMessage} ${assistantMessage}`.toLowerCase();
    const hasImportantKeyword = importantKeywords.some((keyword) =>
      combined.includes(keyword)
    );

    return hasImportantKeyword ? 0.8 : 0.3;
  }

  /**
   * Update conversation
   */
  private async updateConversation(conversation: Conversation): Promise<void> {
    await this.supabase
      .from('ai_conversations')
      .update({
        agent_id: conversation.agent_id,
        status: conversation.status,
        context: conversation.context,
        ended_at: conversation.ended_at,
      })
      .eq('id', conversation.id);
  }

  /**
   * Log tool execution
   */
  private async logToolExecution(
    conversationId: string,
    agentId: string,
    toolName: string,
    input: any,
    output: any,
    success: boolean,
    duration: number,
    userId: string,
    error?: string
  ): Promise<void> {
    try {
      await this.supabase.from('ai_tool_executions').insert({
        conversation_id: conversationId,
        agent_id: agentId,
        tool_name: toolName,
        input,
        output,
        success,
        error,
        duration_ms: duration,
        created_by: userId,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      log.error('[AgentOrchestrator] Error logging tool execution:', err);
    }
  }

  /**
   * Track metrics
   */
  private async trackMetrics(
    conversation: Conversation,
    response: AgentResponse,
    startTime: number
  ): Promise<void> {
    try {
      const latency = Date.now() - startTime;

      await this.supabase.from('ai_metrics').insert({
        agent_id: conversation.agent_id,
        conversation_id: conversation.id,
        metric_type: 'response_latency',
        value: latency,
        dimensions: {
          model: response.model,
          tokens: response.usage?.total_tokens,
        },
        timestamp: new Date().toISOString(),
      });

      if (response.cost) {
        await this.supabase.from('ai_metrics').insert({
          agent_id: conversation.agent_id,
          conversation_id: conversation.id,
          metric_type: 'cost',
          value: response.cost,
          dimensions: {
            model: response.model,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      log.error('[AgentOrchestrator] Error tracking metrics:', error);
    }
  }

  /**
   * Calculate cost based on model and token usage
   */
  private calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    // Pricing per 1M tokens (as of Nov 2024)
    const pricing: Record<
      string,
      { prompt: number; completion: number }
    > = {
      'gpt-4o': { prompt: 2.5, completion: 10 },
      'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
      'gpt-4-turbo': { prompt: 10, completion: 30 },
      'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o'];

    return (
      (promptTokens / 1000000) * modelPricing.prompt +
      (completionTokens / 1000000) * modelPricing.completion
    );
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.redis.quit();
  }
}
