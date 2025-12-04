/**
 * Shared Types
 */

/**
 * Official 9 agents matching production agent_registry database.
 */
export type AgentType =
  | 'farmer'           // Farmer AI Agent
  | 'insurance'        // Insurance AI Agent
  | 'sales_cold_caller' // Sales/Marketing Cold Caller AI Agent
  | 'rides'            // Rides AI Agent
  | 'jobs'             // Jobs AI Agent
  | 'waiter'           // Waiter AI Agent
  | 'real_estate'      // Real Estate AI Agent
  | 'buy_and_sell'     // Buy & Sell AI Agent (unified commerce + business brokerage)
  | 'support';         // Support AI Agent (includes concierge routing)

/**
 * Conversation status
 */
export type ConversationStatus = 'active' | 'ended' | 'escalated' | 'paused';

/**
 * Message role in conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

/**
 * Communication channel
 */
export type Channel = 'whatsapp' | 'web' | 'api' | 'voice';

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  description?: string;
  instructions: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface AIConfig {
  openaiApiKey: string;
  googleApiKey: string;
}

export interface AgentContext {
  userId: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export type AgentRole = "user" | "assistant" | "system" | "tool";

export interface AgentMessage {
  role: AgentRole;
  content: string;
  timestamp: Date;
}
