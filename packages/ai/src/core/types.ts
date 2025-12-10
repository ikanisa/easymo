/**
 * Shared Types for AI Agent System
 */

import { z } from 'zod';

/**
 * Official 7 agents matching production agent_registry database.
 */
export type AgentType =
  | 'farmer'           // Farmer AI Agent
  | 'sales_cold_caller' // Sales/Marketing Cold Caller AI Agent
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
  metadata?: Record<string, unknown>;
}

export interface AIConfig {
  openaiApiKey: string;
  googleApiKey: string;
}

export interface AgentContext {
  userId: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export type AgentRole = "user" | "assistant" | "system" | "tool";

export interface AgentMessage {
  role: AgentRole;
  content: string;
  timestamp: Date;
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  openaiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  maxTurns?: number;
  maxTokensPerConversation?: number;
  defaultTimeout?: number;
  enableTracing?: boolean;
}

/**
 * Conversation state
 */
export interface Conversation {
  id: string;
  user_id: string;
  profile_id?: string;
  agent_id?: string;
  channel: Channel;
  status: ConversationStatus;
  context: Record<string, unknown>;
  started_at?: string;
  ended_at?: string;
  total_cost_usd?: number;
  total_tokens?: number;
  message_count?: number;
}

/**
 * Message in conversation
 */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  timestamp: Date;
  tokens?: TokenUsage;
  latency?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Tool call
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Token usage
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Agent response
 */
export interface AgentResponse {
  message: string;
  usage?: TokenUsage;
  cost?: number;
  latency?: number;
  model?: string;
  toolsExecuted?: string[];
}

/**
 * Process message parameters
 */
export interface ProcessMessageParams {
  userId: string;
  message: string;
  conversationId?: string;
  context?: Record<string, unknown>;
}

/**
 * Execution parameters
 */
export interface ExecutionParams {
  conversation: Conversation;
  message: string;
  memory: string[];
  context?: Record<string, unknown>;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  conversation_id: string;
  content: string;
  embedding?: number[];
  importance_score?: number;
  created_at: string;
  similarity?: number;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  category?: string;
  parameters: z.ZodSchema<unknown> | Record<string, unknown>;
  enabled?: boolean;
  requiresAuth?: boolean;
  /** Execute function (used by orchestrator) */
  execute?: ToolHandler;
  /** Handler function (alias for execute, used by tool definitions) */
  handler?: ToolHandler;
}

/**
 * Tool handler function
 */
export type ToolHandler = (args: unknown, context?: ToolContext) => Promise<unknown>;

/**
 * Tool context
 */
export interface ToolContext {
  conversationId: string;
  userId: string;
  profileId?: string;
  agentId: string;
  supabase?: unknown;
  variables?: Record<string, unknown>;
}

/**
 * Tool execution log
 */
export interface ToolExecution {
  id: string;
  conversationId: string;
  agentId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
  durationMs: number;
  createdAt: Date;
}

/**
 * Metric entry
 */
export interface Metric {
  id: string;
  agentId: string;
  conversationId: string;
  metricType: string;
  value: number;
  dimensions?: Record<string, unknown>;
  timestamp: Date;
}
