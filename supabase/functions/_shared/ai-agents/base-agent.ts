/**
 * Base Agent - Shared foundation for all AI agents
 * 
 * All standalone agents extend this class for common functionality:
 * - Session management
 * - Conversation history
 * - Tool execution
 * - Telemetry logging
 * - Agent-to-agent communication
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AgentSession {
  id: string;
  userId: string;
  agentType?: string;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AgentProcessParams {
  phone: string;
  message: string;
  session: AgentSession;
  supabase: SupabaseClient;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  agentType: string;
  metadata?: Record<string, unknown>;
  handoff?: {
    targetAgent: string;
    context: Record<string, unknown>;
  };
}

export interface AgentConfig {
  systemPrompt: string;
  persona?: {
    name: string;
    role: string;
    tone: string;
  };
  tools: AgentTool[];
  loadedFrom?: 'database' | 'default';
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler?: string;
}

export abstract class BaseAgent {
  abstract type: string;
  abstract name: string;
  abstract description: string;

  protected cachedConfig: AgentConfig | null = null;

  /**
   * Process a user message and generate a response
   */
  abstract process(params: AgentProcessParams): Promise<AgentResponse>;

  /**
   * Get default system prompt (fallback if DB config unavailable)
   */
  abstract getDefaultSystemPrompt(): string;

  /**
   * Load agent configuration from database
   */
  async loadConfig(supabase: SupabaseClient): Promise<AgentConfig> {
    if (this.cachedConfig) return this.cachedConfig;

    try {
      const { data: agent } = await supabase
        .from('ai_agents')
        .select(`
          *,
          ai_agent_personas (*),
          ai_agent_system_instructions (*),
          ai_agent_tools (*)
        `)
        .eq('slug', this.type.replace('_agent', ''))
        .eq('is_active', true)
        .single();

      if (agent) {
        const instruction = agent.ai_agent_system_instructions?.[0];
        const persona = agent.ai_agent_personas?.find((p: any) => p.is_default) || agent.ai_agent_personas?.[0];
        
        this.cachedConfig = {
          systemPrompt: instruction?.instructions || this.getDefaultSystemPrompt(),
          persona: persona ? {
            name: persona.role_name,
            role: persona.role_name,
            tone: persona.tone_style,
          } : undefined,
          tools: (agent.ai_agent_tools || []).map((t: any) => ({
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
            handler: t.config?.handler,
          })),
          loadedFrom: 'database',
        };
      }
    } catch (error) {
      console.error(`Failed to load config for ${this.type}:`, error);
    }

    if (!this.cachedConfig) {
      this.cachedConfig = {
        systemPrompt: this.getDefaultSystemPrompt(),
        tools: [],
        loadedFrom: 'default',
      };
    }

    return this.cachedConfig;
  }

  /**
   * Build conversation history with system prompt
   */
  async buildConversationHistory(
    session: AgentSession,
    supabase: SupabaseClient
  ): Promise<ConversationMessage[]> {
    const config = await this.loadConfig(supabase);
    const messages: ConversationMessage[] = [
      { role: 'system', content: config.systemPrompt }
    ];

    // Add conversation history from session
    if (session.conversationHistory) {
      messages.push(...session.conversationHistory);
    }

    return messages;
  }

  /**
   * Log agent interaction for telemetry
   */
  async logInteraction(
    session: AgentSession,
    userMessage: string,
    response: string,
    supabase: SupabaseClient,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await supabase.from('ai_agent_metrics').insert({
        agent_id: null, // Will be resolved by trigger
        channel: 'whatsapp',
        session_id: session.id,
        duration_ms: 0,
        success: true,
        tools_executed: [],
        ...metadata,
      });
    } catch {
      // Non-fatal
    }
  }

  /**
   * Request handoff to another agent
   */
  createHandoff(targetAgent: string, context: Record<string, unknown>): AgentResponse['handoff'] {
    return { targetAgent, context };
  }
}
