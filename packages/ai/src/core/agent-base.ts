/**
 * Enhanced Agent Base Class
 *
 * Provides:
 * - Unified LLM interface (OpenAI + Gemini)
 * - Tool registration and execution
 * - Memory management integration
 * - Observability and tracing
 * - Error handling and retries
 *
 * @packageDocumentation
 */

import { childLogger } from '@easymo/commons';
import { EventEmitter } from 'events';

import type { MemoryManager } from '../memory/memory-manager.js';
import type { Tool, ToolContext } from '../types/index.js';
import type {
  IUnifiedAIProvider,
  UnifiedChatConfig,
  UnifiedChatResponse,
  UnifiedMessage,
  UnifiedToolCall,
} from './unified-provider.js';

const log = childLogger({ service: 'agent-base' });

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Configuration for initializing an agent
 */
export interface AgentConfig {
  /** LLM provider instance */
  llmProvider?: IUnifiedAIProvider;
  /** Memory manager instance */
  memoryManager?: MemoryManager;
  /** Model to use for this agent */
  model?: string;
  /** Temperature for responses (0-1) */
  temperature?: number;
  /** Maximum tokens per response */
  maxTokens?: number;
  /** Maximum conversation turns for ReAct */
  maxTurns?: number;
  /** Enable tracing/observability */
  enableTracing?: boolean;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
}

/**
 * Input for agent execution
 */
export interface AgentInput {
  /** User message */
  message: string;
  /** User ID */
  userId: string;
  /** Conversation ID */
  conversationId: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Result from agent execution
 */
export interface AgentResult {
  /** Agent's text response */
  message: string;
  /** Tool calls executed */
  toolCalls?: UnifiedToolCall[];
  /** Tools that were executed */
  toolsExecuted?: string[];
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Cost in USD */
  costUsd?: number;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Model used */
  model?: string;
  /** Whether agent needs handoff */
  needsHandoff?: boolean;
  /** Suggested agent for handoff */
  handoffAgent?: string;
  /** Reason for handoff */
  handoffReason?: string;
}

/**
 * Context passed during agent execution
 */
export interface AgentContext {
  /** User ID */
  userId: string;
  /** Conversation ID */
  conversationId: string;
  /** Current agent name */
  agentName: string;
  /** Session data */
  sessionData?: Record<string, unknown>;
  /** Variables from memory/context */
  variables?: Record<string, unknown>;
  /** Correlation ID for tracing */
  correlationId?: string;
}

/**
 * Memory context loaded for the agent
 */
export interface MemoryContext {
  /** Short-term memory (recent messages) */
  recentMessages: UnifiedMessage[];
  /** Long-term memory (relevant facts) */
  relevantFacts: string[];
  /** Working memory (temporary state) */
  workingState?: Record<string, unknown>;
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  /** Whether tool succeeded */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  durationMs?: number;
}

// ============================================================================
// AGENT BASE CLASS
// ============================================================================

/**
 * Abstract base class for all AI agents
 *
 * Provides common functionality for:
 * - Tool registration and execution
 * - Memory integration
 * - Observability/tracing
 * - Error handling with retries
 */
export abstract class AgentBase extends EventEmitter {
  // Core properties - must be implemented by subclasses
  abstract readonly name: string;
  abstract readonly slug: string;
  abstract readonly instructions: string;
  abstract readonly tools: Tool[];

  // Configuration
  protected model: string = 'gpt-4o-mini';
  protected temperature: number = 0.7;
  protected maxTokens: number = 4096;
  protected maxTurns: number = 5;
  protected enableTracing: boolean = true;

  // Dependencies
  protected llmProvider: IUnifiedAIProvider | null = null;
  protected memoryManager: MemoryManager | null = null;
  protected correlationId: string = '';

  // Tool registry for this agent
  private registeredTools: Map<string, Tool> = new Map();

  constructor(config?: AgentConfig) {
    super();
    this.initializeDependencies(config);
  }

  /**
   * Initialize dependencies from config
   */
  protected initializeDependencies(config?: AgentConfig): void {
    if (config?.llmProvider) {
      this.llmProvider = config.llmProvider;
    }
    if (config?.memoryManager) {
      this.memoryManager = config.memoryManager;
    }
    if (config?.model) {
      this.model = config.model;
    }
    if (config?.temperature !== undefined) {
      this.temperature = config.temperature;
    }
    if (config?.maxTokens !== undefined) {
      this.maxTokens = config.maxTokens;
    }
    if (config?.maxTurns !== undefined) {
      this.maxTurns = config.maxTurns;
    }
    if (config?.enableTracing !== undefined) {
      this.enableTracing = config.enableTracing;
    }
    if (config?.correlationId) {
      this.correlationId = config.correlationId;
    }

    // Register tools
    this.registerTools();
  }

  /**
   * Register all tools for this agent
   */
  protected registerTools(): void {
    for (const tool of this.tools) {
      this.registeredTools.set(tool.name, tool);
    }
    this.log('TOOLS_REGISTERED', { count: this.tools.length });
  }

  /**
   * Main execution entry point - must be implemented by subclasses
   */
  abstract execute(input: AgentInput): Promise<AgentResult>;

  /**
   * Execute with ReAct pattern (Reason-Act-Observe loop)
   *
   * This implements the ReAct prompting pattern where the agent:
   * 1. Reasons about what to do
   * 2. Takes an action (calls a tool)
   * 3. Observes the result
   * 4. Repeats until done
   */
  protected async executeReAct(
    messages: UnifiedMessage[],
    context: AgentContext,
    maxTurns?: number,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const turns = maxTurns ?? this.maxTurns;
    const currentMessages = [...messages];
    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let totalCost = 0;
    const toolsExecuted: string[] = [];

    this.log('REACT_START', { turns, messageCount: messages.length });

    for (let turn = 0; turn < turns; turn++) {
      this.log('REACT_TURN', { turn: turn + 1, maxTurns: turns });

      // Get LLM response
      const response = await this.callLLM(currentMessages, context);

      // Accumulate usage
      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
        totalUsage.totalTokens += response.usage.totalTokens;
      }
      totalCost += response.costUsd;

      // Check for tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Add assistant message with tool calls
        currentMessages.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute tools and add results
        for (const toolCall of response.toolCalls) {
          const toolResult = await this.executeTool(
            toolCall.name,
            toolCall.arguments,
            context,
          );

          toolsExecuted.push(toolCall.name);

          // Add tool result as message
          currentMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult.data ?? { error: toolResult.error }),
            name: toolCall.name,
            toolCallId: toolCall.id,
          });
        }

        // Continue to next turn
        continue;
      }

      // No tool calls - we have a final response
      const latencyMs = Date.now() - startTime;

      this.log('REACT_COMPLETE', {
        turns: turn + 1,
        toolsExecuted,
        latencyMs,
      });

      return {
        message: response.content || '',
        toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
        usage: totalUsage,
        costUsd: totalCost,
        latencyMs,
        model: response.model,
      };
    }

    // Max turns reached - return last response
    this.log('REACT_MAX_TURNS', { turns });

    return {
      message: 'I apologize, but I was unable to complete your request. Please try again or contact support.',
      toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
      usage: totalUsage,
      costUsd: totalCost,
      latencyMs: Date.now() - startTime,
      model: this.model,
    };
  }

  /**
   * Call the LLM with the current messages
   */
  protected async callLLM(
    messages: UnifiedMessage[],
    context: AgentContext,
  ): Promise<UnifiedChatResponse> {
    if (!this.llmProvider) {
      throw new Error('LLM provider not configured');
    }

    const config: UnifiedChatConfig = {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      tools: this.getToolDefinitions(),
      toolChoice: this.tools.length > 0 ? 'auto' : undefined,
      userId: context.userId,
      correlationId: context.correlationId,
    };

    return await this.withRetry(
      () => this.llmProvider!.chat(messages, config),
      3,
    );
  }

  /**
   * Get tool definitions for LLM function calling
   */
  protected getToolDefinitions(): UnifiedChatConfig['tools'] {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.parameters),
    }));
  }

  /**
   * Execute a single tool
   */
  protected async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.registeredTools.get(toolName);

    if (!tool) {
      this.log('TOOL_NOT_FOUND', { toolName });
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    this.log('TOOL_EXECUTE_START', { toolName, params });

    try {
      // Validate params with Zod schema
      const validatedParams = tool.parameters.parse(params);

      // Build tool context
      const toolContext: ToolContext = {
        conversationId: context.conversationId,
        userId: context.userId,
        agentId: this.slug,
        variables: context.variables,
      };

      // Execute the tool
      const result = await tool.handler(validatedParams, toolContext);
      const durationMs = Date.now() - startTime;

      this.log('TOOL_EXECUTE_SUCCESS', { toolName, durationMs });

      return {
        success: true,
        data: result,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log('TOOL_EXECUTE_ERROR', { toolName, error: errorMessage, durationMs });

      return {
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  /**
   * Load memory context for the agent
   */
  protected async loadMemory(
    _userId: string,
    conversationId: string,
    query?: string,
  ): Promise<MemoryContext> {
    if (!this.memoryManager) {
      return {
        recentMessages: [],
        relevantFacts: [],
      };
    }

    try {
      // Load short-term memory (recent messages)
      const shortTermMessages = await this.memoryManager.getShortTerm(conversationId, 20);
      const recentMessages: UnifiedMessage[] = shortTermMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
      }));

      // Load long-term memory if query provided
      let relevantFacts: string[] = [];
      if (query) {
        const memories = await this.memoryManager.retrieveRelevant(query, 5);
        relevantFacts = memories.map((m) => m.content);
      }

      // Load working memory
      const workingState = await this.memoryManager.getWorkingMemory(this.slug, 'state');

      this.log('MEMORY_LOADED', {
        recentCount: recentMessages.length,
        factsCount: relevantFacts.length,
        hasWorkingState: !!workingState,
      });

      return {
        recentMessages,
        relevantFacts,
        workingState,
      };
    } catch (error) {
      this.log('MEMORY_LOAD_ERROR', { error: String(error) });
      return {
        recentMessages: [],
        relevantFacts: [],
      };
    }
  }

  /**
   * Save to memory after interaction
   */
  protected async saveMemory(
    _userId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string,
  ): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    try {
      // Save to short-term memory
      await this.memoryManager.saveShortTerm(conversationId, {
        id: `msg_${Date.now()}`,
        conversationId,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      });

      await this.memoryManager.saveShortTerm(conversationId, {
        id: `msg_${Date.now()}_assistant`,
        conversationId,
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      });

      this.log('MEMORY_SAVED', { conversationId });
    } catch (error) {
      this.log('MEMORY_SAVE_ERROR', { error: String(error) });
    }
  }

  /**
   * Save to long-term memory
   */
  protected async saveLongTermMemory(
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    try {
      await this.memoryManager.saveLongTerm(content, metadata);
      this.log('LONG_TERM_MEMORY_SAVED', { contentLength: content.length });
    } catch (error) {
      this.log('LONG_TERM_MEMORY_ERROR', { error: String(error) });
    }
  }

  /**
   * Handle errors with retries using exponential backoff
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt);
          this.log('RETRY_ATTEMPT', {
            attempt: attempt + 1,
            maxRetries,
            delayMs,
            error: lastError.message,
          });
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * Emit observability event
   */
  protected log(event: string, data?: Record<string, unknown>): void {
    if (!this.enableTracing) {
      return;
    }

    const logData = {
      event,
      agent: this.name,
      slug: this.slug,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    log.info(logData, `[${this.name}] ${event}`);
    this.emit('trace', logData);
  }

  /**
   * Build system prompt with instructions and context
   */
  protected buildSystemPrompt(memoryContext?: MemoryContext): string {
    let prompt = this.instructions;

    // Add relevant facts from memory
    if (memoryContext?.relevantFacts && memoryContext.relevantFacts.length > 0) {
      prompt += '\n\n## Relevant Context from Memory\n';
      prompt += memoryContext.relevantFacts.map((f) => `- ${f}`).join('\n');
    }

    return prompt;
  }

  /**
   * Build messages array for LLM
   */
  protected buildMessages(
    input: AgentInput,
    memoryContext?: MemoryContext,
  ): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];

    // System prompt
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(memoryContext),
    });

    // Recent conversation history
    if (memoryContext?.recentMessages) {
      messages.push(...memoryContext.recentMessages);
    }

    // Current user message
    messages.push({
      role: 'user',
      content: input.message,
    });

    return messages;
  }

  /**
   * Check if agent should hand off to another agent
   */
  protected shouldHandoff(
    _message: string,
    _context: AgentContext,
  ): { needsHandoff: boolean; targetAgent?: string; reason?: string } {
    // Base implementation - can be overridden by subclasses
    return { needsHandoff: false };
  }

  /**
   * Convert Zod schema to JSON Schema (simplified)
   */
  private zodToJsonSchema(schema: unknown): Record<string, unknown> {
    // This is a simplified version - for production use zod-to-json-schema
    const zodDef = (schema as { _def?: { typeName?: string } })?._def;

    if (!zodDef) {
      return { type: 'object', properties: {} };
    }

    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
