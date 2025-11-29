/**
 * Shared AI Types - EasyMO AI Agents Architecture
 * Centralized type definitions for all AI providers
 */

export type AIProvider = 'openai' | 'gemini' | 'multi';

export type AIModel = 
  // OpenAI Models
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'o1'
  | 'o1-mini'
  | 'o3-mini'
  // Google Models
  | 'gemini-2.0-flash-exp'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-8b';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface AICompletionOptions {
  model?: AIModel;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'json_object' | 'json_schema'; json_schema?: unknown };
  stream?: boolean;
}

export interface AICompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: AIMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<AIMessage>;
    finish_reason: string | null;
  }>;
}

export interface RealtimeConfig {
  modalities?: ('text' | 'audio')[];
  voice?: string;
  instructions?: string;
  turn_detection?: {
    type: 'server_vad';
    threshold?: number;
    silence_duration_ms?: number;
  };
}

export interface GroundingSource {
  type: 'google_search' | 'inline_context' | 'vertex_ai_search';
  query?: string;
  context?: string;
}

export interface ImageGenerationOptions {
  prompt: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface AgentConfig {
  id: string;
  provider: AIProvider;
  model: AIModel;
  name: string;
  description?: string;
  instructions?: string;
  tools?: ToolDefinition[];
  metadata?: Record<string, unknown>;
}

export interface AgentSession {
  id: string;
  agentId: string;
  userId?: string;
  messages: AIMessage[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  concurrent?: number;
}

export interface FallbackConfig {
  enabled: boolean;
  providers: AIProvider[];
  maxRetries: number;
  retryDelay: number;
}

export interface HealthCheck {
  provider: AIProvider;
  status: 'healthy' | 'degraded' | 'unavailable';
  latency?: number;
  error?: string;
  timestamp: Date;
}
