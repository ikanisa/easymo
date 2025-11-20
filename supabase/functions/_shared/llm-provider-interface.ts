/**
 * LLM Provider Interface
 * 
 * Vendor-agnostic interface for LLM providers (OpenAI, Gemini, etc.)
 * Enables transparent switching and failover between providers.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMCompletionOptions {
  model: string;
  system?: string;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMCompletionResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  metadata: {
    model: string;
    provider: string;
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    finishReason?: string;
  };
}

export interface LLMProvider {
  readonly name: string;
  readonly supportedModels: string[];
  
  /**
   * Send a chat completion request
   */
  chat(options: LLMCompletionOptions): Promise<LLMCompletionResponse>;
  
  /**
   * Generate embeddings for semantic search
   */
  embeddings(text: string, model?: string): Promise<number[]>;
  
  /**
   * Analyze an image with vision capabilities
   */
  analyzeImage?(imageUrl: string, prompt: string): Promise<string>;
  
  /**
   * Check if provider is healthy
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Provider configuration stored in database or config
 */
export interface ProviderConfig {
  provider: 'openai' | 'gemini';
  primaryModel: string;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * Agent-level provider routing rules
 */
export interface AgentProviderRules {
  agentSlug: string;
  primaryProvider: 'openai' | 'gemini';
  fallbackProvider?: 'openai' | 'gemini';
  providerConfig: {
    openai?: ProviderConfig;
    gemini?: ProviderConfig;
  };
  toolProviders?: Record<string, 'openai' | 'gemini'>; // Tool-specific routing
}
