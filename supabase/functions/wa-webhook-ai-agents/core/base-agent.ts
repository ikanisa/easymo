/**
 * Base Agent Interface
 * All AI agents must extend this abstract class
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * 
 * NOW USES DATABASE-DRIVEN CONFIGURATION:
 * - Loads personas, system instructions, tools from database via AgentConfigLoader
 * - Falls back to hardcoded prompts if database config not available
 * - Provides tool execution via ToolExecutor
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AgentConfigLoader, type AgentConfig, type AgentTool } from '../../_shared/agent-config-loader.ts';
import { ToolExecutor, type ToolExecutionContext, type ToolExecutionResult } from '../../_shared/tool-executor.ts';

export interface Session {
  id: string;
  phone: string;
  context: Record<string, any>;
  currentAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentProcessParams {
  message: string;
  session: Session;
  supabase: SupabaseClient;
}

export interface AgentResponse {
  message: string;
  agentType: string;
  nextState?: string;
  metadata?: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * AI Provider Interface - abstraction over Gemini/OpenAI
 */
export interface IAIProvider {
  chat(messages: Message[], config?: ChatConfig): Promise<string>;
  stream?(messages: Message[], config?: ChatConfig): AsyncIterable<string>;
}

/**
 * Base Agent Class
 * All agents (Waiter, Farmer, Jobs, etc.) extend this
 * 
 * NOW DATABASE-DRIVEN:
 * - System prompts loaded from ai_agent_system_instructions table
 * - Personas loaded from ai_agent_personas table
 * - Tools loaded from ai_agent_tools table
 */
export abstract class BaseAgent {
  abstract type: string;
  abstract name: string;
  abstract description: string;

  /**
   * The database agent slug - maps to ai_agents.slug
   * Override this if agent type differs from database slug
   */
  protected get agentSlug(): string {
    // Convert internal agent type to database slug
    // e.g., 'waiter_agent' -> 'waiter', 'business_broker_agent' -> 'broker' or 'marketplace'
    const mapping: Record<string, string> = {
      'waiter_agent': 'waiter',
      'farmer_agent': 'farmer',
      'jobs_agent': 'jobs',
      'real_estate_agent': 'real_estate',
      'business_broker_agent': 'marketplace', // Marketplace replaces broker
      'support_agent': 'support',
      'rides_agent': 'rides',
      'insurance_agent': 'insurance',
      'sales_cold_caller_agent': 'sales_cold_caller',
    };
    return mapping[this.type] || this.type.replace('_agent', '');
  }

  // Database-driven config and tool execution
  protected configLoader: AgentConfigLoader | null = null;
  protected toolExecutor: ToolExecutor | null = null;
  protected cachedConfig: AgentConfig | null = null;

  /**
   * Main processing method - must be implemented by each agent
   */
  abstract process(params: AgentProcessParams): Promise<AgentResponse>;

  /**
   * Default system prompt for this agent - used as fallback if database config unavailable
   * Subclasses should override this with their specific prompt
   */
  abstract getDefaultSystemPrompt(): string;

  /**
   * System prompt for this agent - NOW LOADS FROM DATABASE
   * Falls back to getDefaultSystemPrompt() if database config not available
   * @deprecated Use getSystemPromptAsync() for database-driven config
   */
  getSystemPrompt(): string {
    // For backward compatibility, return cached database prompt or default
    if (this.cachedConfig?.systemInstructions?.instructions) {
      return this.buildSystemPromptFromConfig(this.cachedConfig);
    }
    return this.getDefaultSystemPrompt();
  }

  /**
   * Initialize database-driven config loader and tool executor
   * Must be called with supabase client before using database features
   */
  protected initializeDatabaseConfig(supabase: SupabaseClient): void {
    if (!this.configLoader) {
      this.configLoader = new AgentConfigLoader(supabase);
    }
    if (!this.toolExecutor) {
      this.toolExecutor = new ToolExecutor(supabase);
    }
  }

  /**
   * Load agent configuration from database
   * Returns cached config if already loaded (5-min cache TTL in AgentConfigLoader)
   */
  protected async loadConfig(supabase: SupabaseClient): Promise<AgentConfig> {
    this.initializeDatabaseConfig(supabase);
    
    if (!this.configLoader) {
      throw new Error(
        `Config loader not initialized for agent ${this.type} (slug: ${this.agentSlug}). ` +
        `This should not happen - please report this as a bug.`
      );
    }

    const config = await this.configLoader.loadAgentConfig(this.agentSlug);
    this.cachedConfig = config;
    
    console.log(JSON.stringify({
      event: 'AGENT_CONFIG_LOADED',
      agentType: this.type,
      agentSlug: this.agentSlug,
      loadedFrom: config.loadedFrom,
      hasPersona: !!config.persona,
      hasInstructions: !!config.systemInstructions,
      toolsCount: config.tools.length,
      tasksCount: config.tasks.length,
    }));
    
    return config;
  }

  /**
   * Get system prompt from database - async version
   * Falls back to getDefaultSystemPrompt() if database unavailable
   */
  async getSystemPromptAsync(supabase: SupabaseClient): Promise<string> {
    try {
      const config = await this.loadConfig(supabase);
      
      if (config.loadedFrom === 'database' && config.systemInstructions?.instructions) {
        return this.buildSystemPromptFromConfig(config);
      }
      
      // Fallback to default
      console.log(JSON.stringify({
        event: 'AGENT_USING_DEFAULT_PROMPT',
        agentType: this.type,
        reason: config.loadedFrom === 'fallback' ? 'database_load_failed' : 'no_db_instructions',
      }));
      return this.getDefaultSystemPrompt();
    } catch (error) {
      console.error(JSON.stringify({
        event: 'AGENT_PROMPT_LOAD_ERROR',
        agentType: this.type,
        error: error instanceof Error ? error.message : String(error),
      }));
      return this.getDefaultSystemPrompt();
    }
  }

  /**
   * Build complete system prompt from database config
   * Combines persona, instructions, guardrails, and available tools
   */
  protected buildSystemPromptFromConfig(config: AgentConfig): string {
    const parts: string[] = [];

    // Add persona if available
    if (config.persona) {
      parts.push(`Role: ${config.persona.role_name}`);
      parts.push(`Tone: ${config.persona.tone_style}`);
      if (config.persona.languages?.length) {
        parts.push(`Languages: ${config.persona.languages.join(', ')}`);
      }
      if (config.persona.traits && Object.keys(config.persona.traits).length > 0) {
        parts.push(`Traits: ${JSON.stringify(config.persona.traits)}`);
      }
      parts.push('');
    }

    // Add system instructions
    if (config.systemInstructions?.instructions) {
      parts.push(config.systemInstructions.instructions);
      
      if (config.systemInstructions.guardrails) {
        parts.push('');
        parts.push('GUARDRAILS:');
        parts.push(config.systemInstructions.guardrails);
      }
    }

    // Add available tools info
    if (config.tools.length > 0) {
      parts.push('');
      parts.push('AVAILABLE TOOLS:');
      for (const tool of config.tools) {
        parts.push(`- ${tool.name}: ${tool.description}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get available tools from database config
   */
  async getTools(supabase: SupabaseClient): Promise<AgentTool[]> {
    const config = await this.loadConfig(supabase);
    return config.tools;
  }

  /**
   * Execute a tool by name using database-driven tool execution
   */
  async executeTool(
    toolName: string,
    inputs: Record<string, unknown>,
    context: { userId: string; conversationId: string; sessionId?: string },
    supabase: SupabaseClient
  ): Promise<ToolExecutionResult> {
    const config = await this.loadConfig(supabase);
    const tool = config.tools.find(t => t.name === toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        executionTime: 0,
        toolName,
        toolType: 'unknown',
      };
    }

    this.initializeDatabaseConfig(supabase);
    
    if (!this.toolExecutor) {
      return {
        success: false,
        error: `Tool executor not initialized for agent ${this.type}. Ensure supabase client is passed to executeTool().`,
        executionTime: 0,
        toolName,
        toolType: tool.tool_type,
      };
    }

    // Get agent ID for context
    const agentId = await this.getAgentId(supabase);

    const toolContext: ToolExecutionContext = {
      userId: context.userId,
      agentId: agentId || '',
      conversationId: context.conversationId,
      agentSlug: this.agentSlug,
      sessionId: context.sessionId,
    };

    return this.toolExecutor.executeTool(tool, inputs, toolContext);
  }

  /**
   * Get agent ID from database
   */
  protected async getAgentId(supabase: SupabaseClient): Promise<string | null> {
    const { data } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('slug', this.agentSlug)
      .eq('is_active', true)
      .single();
    
    return data?.id || null;
  }

  /**
   * Helper to build conversation history from session
   * NOW USES DATABASE-DRIVEN SYSTEM PROMPT
   */
  protected buildConversationHistory(session: Session): Message[] {
    const history: Message[] = [];
    
    // Add system prompt (uses cached config if available, else default)
    history.push({
      role: 'system',
      content: this.getSystemPrompt(),
    });

    // Add context if exists
    if (session.context && Object.keys(session.context).length > 0) {
      history.push({
        role: 'system',
        content: `Current context: ${JSON.stringify(session.context, null, 2)}`,
      });
    }

    // Add conversation history if stored in context
    if (session.context?.conversationHistory) {
      const pastMessages = session.context.conversationHistory as Message[];
      history.push(...pastMessages);
    }

    return history;
  }

  /**
   * Build conversation history with async database prompt loading
   */
  protected async buildConversationHistoryAsync(
    session: Session,
    supabase: SupabaseClient
  ): Promise<Message[]> {
    const history: Message[] = [];
    
    // Load system prompt from database
    const systemPrompt = await this.getSystemPromptAsync(supabase);
    
    history.push({
      role: 'system',
      content: systemPrompt,
    });

    // Add context if exists
    if (session.context && Object.keys(session.context).length > 0) {
      history.push({
        role: 'system',
        content: `Current context: ${JSON.stringify(session.context, null, 2)}`,
      });
    }

    // Add conversation history if stored in context
    if (session.context?.conversationHistory) {
      const pastMessages = session.context.conversationHistory as Message[];
      history.push(...pastMessages);
    }

    return history;
  }

  /**
   * Helper to update conversation history in session
   */
  protected async updateConversationHistory(
    session: Session,
    userMessage: string,
    agentResponse: string,
    supabase: SupabaseClient
  ): Promise<void> {
    const history = session.context?.conversationHistory || [];
    
    // Add user message
    history.push({
      role: 'user' as const,
      content: userMessage,
    });

    // Add agent response
    history.push({
      role: 'assistant' as const,
      content: agentResponse,
    });

    // Keep only last 10 messages to prevent context overflow
    const trimmedHistory = history.slice(-10);

    // Update session context
    await supabase
      .from('ai_agent_sessions')
      .update({
        context: {
          ...session.context,
          conversationHistory: trimmedHistory,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
  }

  /**
   * Helper to log agent interaction
   */
  protected async logInteraction(
    session: Session,
    userMessage: string,
    agentResponse: string,
    supabase: SupabaseClient,
    metadata?: Record<string, any>
  ): Promise<void> {
    await supabase.from('ai_agent_interactions').insert({
      session_id: session.id,
      agent_type: this.type,
      user_message: userMessage,
      agent_response: agentResponse,
      metadata: {
        ...metadata,
        agentSlug: this.agentSlug,
        configSource: this.cachedConfig?.loadedFrom || 'not_loaded',
      },
      created_at: new Date().toISOString(),
    });
  }
}
