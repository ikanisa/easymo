/**
 * Base Agent Interface
 * All AI agents must extend this abstract class
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
 */
export abstract class BaseAgent {
  abstract type: string;
  abstract name: string;
  abstract description: string;

  /**
   * Main processing method - must be implemented by each agent
   */
  abstract process(params: AgentProcessParams): Promise<AgentResponse>;

  /**
   * System prompt for this agent - defines agent behavior
   */
  abstract getSystemPrompt(): string;

  /**
   * Helper to build conversation history from session
   */
  protected buildConversationHistory(session: Session): Message[] {
    const history: Message[] = [];
    
    // Add system prompt
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
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  }
}
