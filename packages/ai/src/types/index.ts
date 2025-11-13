import { z } from 'zod';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentType = 
  | 'triage'           // Route user to correct agent
  | 'customer_service' // General help and support
  | 'booking'          // Handle bookings/appointments
  | 'payment'          // Payment processing
  | 'property'         // Property rentals
  | 'driver'           // Driver services
  | 'shop'             // Shop/marketplace
  | 'general';         // Fallback agent

export type AgentStatus = 'active' | 'inactive' | 'error' | 'processing';
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';
export type ConversationStatus = 'active' | 'paused' | 'ended' | 'escalated';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  description?: string;
  model: ModelConfig;
  systemPrompt: string;
  tools: ToolConfig[];
  memory: MemoryConfig;
  routing: RoutingConfig;
  monitoring: MonitoringConfig;
  metadata?: Record<string, any>;
}

export interface ModelConfig {
  provider: 'openai';
  name: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  responseFormat?: 'text' | 'json_object';
  seed?: number;
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface MemoryConfig {
  shortTerm: {
    enabled: boolean;
    maxMessages?: number;
    ttl?: number; // seconds
  };
  longTerm: {
    enabled: boolean;
    topK?: number;
  };
  working: {
    enabled: boolean;
    maxItems?: number;
  };
}

export interface RoutingConfig {
  triggers?: string[];
  priority: number;
  fallbackAgent?: string;
  maxRetries?: number;
}

export interface MonitoringConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;
  tracingEnabled: boolean;
  alertThresholds?: {
    latency?: number;
    errorRate?: number;
    tokenUsage?: number;
    cost?: number;
  };
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export interface Conversation {
  id: string;
  agentId: string;
  userId: string; // phone number
  profileId?: string;
  channel: 'whatsapp' | 'web' | 'api';
  status: ConversationStatus;
  messages: Message[];
  context: ConversationContext;
  startedAt: Date;
  endedAt?: Date;
  totalCostUsd: number;
  metadata?: Record<string, any>;
}

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
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ConversationContext {
  variables: Record<string, any>;
  sessionData?: Record<string, any>;
  userProfile?: {
    name?: string;
    language?: string;
    preferences?: Record<string, any>;
  };
  previousSummary?: string;
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface AgentExecution {
  conversationId: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  stream?: boolean;
  context?: ConversationContext;
}

export interface AgentResponse {
  message: Message;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  metrics?: ExecutionMetrics;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ExecutionMetrics {
  latencyMs: number;
  llmLatencyMs: number;
  toolExecutionMs?: number;
  costUsd: number;
  tokensPerSecond?: number;
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  handler: ToolHandler;
  category?: string;
  requiresAuth?: boolean;
  rateLimit?: RateLimit;
}

export type ToolHandler = (args: any, context?: ToolContext) => Promise<any>;

export interface ToolContext {
  conversationId: string;
  userId: string;
  agentId: string;
  variables?: Record<string, any>;
  supabase?: any;
}

export interface RateLimit {
  requests: number;
  window: 'second' | 'minute' | 'hour';
}

// ============================================================================
// MEMORY TYPES
// ============================================================================

export interface Memory {
  id: string;
  type: 'short' | 'long' | 'working';
  content: any;
  embedding?: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
  similarity?: number;
}

// ============================================================================
// MONITORING TYPES
// ============================================================================

export interface AgentMetrics {
  agentId: string;
  conversationId: string;
  timestamp: Date;
  tokens: TokenUsage;
  latency: ExecutionMetrics;
  success: boolean;
  error?: string;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

export interface StreamChunk {
  delta: string | null;
  toolCall?: Partial<ToolCall>;
  usage?: TokenUsage;
  done: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// ============================================================================
// WHATSAPP INTEGRATION TYPES
// ============================================================================

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'button' | 'image' | 'document';
  text?: {
    body: string;
  };
  interactive?: {
    type: 'list_reply' | 'button_reply';
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
    button_reply?: {
      id: string;
      title: string;
    };
  };
}

export interface WhatsAppContext {
  phoneNumber: string;
  userName?: string;
  language?: string;
  profileId?: string;
  state?: any;
}
