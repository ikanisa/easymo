/**
 * Core types for AI Agent System
 * 
 * @packageDocumentation
 */

/**
 * Official 10 agents matching production agent_registry database.
 */
export type AgentType =
  | 'farmer'           // Farmer AI Agent
  | 'insurance'        // Insurance AI Agent
  | 'sales_cold_caller' // Sales/Marketing Cold Caller AI Agent
  | 'rides'            // Rides AI Agent
  | 'jobs'             // Jobs AI Agent
  | 'waiter'           // Waiter AI Agent
  | 'real_estate'      // Real Estate AI Agent
  | 'marketplace'      // Marketplace AI Agent (includes pharmacy, hardware, shop)
  | 'support'          // Support AI Agent (includes concierge routing)
  | 'business_broker'; // Business Broker AI Agent (includes legal intake)

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

/**
 * Conversation record
 */
export interface Conversation {
  id: string;
  agent_id: string | null;
  user_id: string;
  profile_id?: string;
  channel: Channel;
  status: ConversationStatus;
  context: Record<string, any>;
  started_at: string;
  ended_at?: string;
  last_message_at?: string;
  summary?: string;
  total_cost_usd: number;
  total_tokens: number;
  message_count: number;
  metadata?: Record<string, any>;
}

/**
 * Message record
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  tokens_prompt?: number;
  tokens_completion?: number;
  tokens_total?: number;
  cost_usd?: number;
  latency_ms?: number;
  model?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

/**
 * Tool call from OpenAI
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
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  category?: string;
  parameters: any; // JSON Schema
  enabled: boolean;
  requiresAuth: boolean;
  execute: ToolHandler;
}

/**
 * Tool handler function
 */
export type ToolHandler = (
  args: any,
  context: ToolContext
) => Promise<any>;

/**
 * Tool execution context
 */
export interface ToolContext {
  conversationId: string;
  userId: string;
  profileId?: string;
  agentId: string;
  supabase: any;
  variables?: Record<string, any>;
}

/**
 * Agent response
 */
export interface AgentResponse {
  message: string;
  usage?: TokenUsage;
  cost?: number;
  toolsExecuted?: string[];
  latency?: number;
  model?: string;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Message processing parameters
 */
export interface ProcessMessageParams {
  userId: string;
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
}

/**
 * Agent execution parameters
 */
export interface ExecutionParams {
  conversation: Conversation;
  message: string;
  memory: string[];
  context?: Record<string, any>;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  openaiKey: string;
  redisUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Memory entry for embeddings
 */
export interface MemoryEntry {
  id: string;
  conversation_id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
  importance_score: number;
  created_at: string;
  similarity?: number;
}

/**
 * Metric record
 */
export interface Metric {
  agent_id: string;
  conversation_id: string;
  metric_type: string;
  value: number;
  dimensions?: Record<string, any>;
  timestamp: string;
}

/**
 * Tool execution log
 */
export interface ToolExecution {
  id: string;
  conversation_id: string;
  agent_id: string;
  tool_name: string;
  input: any;
  output?: any;
  success: boolean;
  error?: string;
  duration_ms: number;
  created_at: string;
  created_by: string;
}
