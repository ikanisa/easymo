import { SupabaseClient } from '@supabase/supabase-js';

export interface AgentInput {
  userId: string;
  query: string;
  context?: AgentContext;
  hasImages?: boolean;
  hasVideo?: boolean;
  contextLength?: number;
  requiresCodeExecution?: boolean;
  complexity?: 'low' | 'medium' | 'high';
  priority?: 'cost' | 'quality' | 'speed';
}

export interface AgentResult {
  success: boolean;
  finalOutput: string;
  data?: any;
  toolsInvoked: ToolInvocation[];
  duration: number;
  modelUsed?: 'gemini' | 'gpt5';
  error?: string;
}

export interface AgentContext {
  userId: string;
  conversationHistory?: Message[];
  metadata?: Record<string, any>;
  supabase?: SupabaseClient;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  capabilities?: string[];
  execute: (params: any, context: AgentContext) => Promise<any>;
}

export interface ToolInvocation {
  toolName: string;
  params: any;
  result: any;
  duration: number;
  timestamp: Date;
}

export interface AgentSession {
  id: string;
  userId: string;
  agentType: string;
  startTime: Date;
  deadline?: Date;
  context: AgentContext;
}

export type ModelType = 'gemini-2.5-pro' | 'gemini-3.0' | 'gpt-5' | 'gpt-4-turbo';

export interface ModelConfig {
  model: ModelType;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface VoiceConfig {
  enabled: boolean;
  provider: 'openai_realtime' | 'none';
  voice?: 'alloy' | 'echo' | 'shimmer';
}

export interface VisionConfig {
  enabled: boolean;
  provider: 'gemini' | 'gpt4v';
}

export interface MemoryConfig {
  enabled: boolean;
  maxContextLength: number;
  vectorStore?: 'supabase' | 'pinecone';
}
