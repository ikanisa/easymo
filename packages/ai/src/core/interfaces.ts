/**
 * Unified AI Agent Orchestrator Interfaces
 *
 * Provides a common interface for all AgentOrchestrator implementations
 * across the codebase (Deno Edge Functions, Node.js services).
 *
 * This consolidates the multiple orchestrator implementations:
 * - packages/ai/src/core/orchestrator.ts (Node.js)
 * - supabase/functions/_shared/agent-orchestrator.ts (Deno)
 * - supabase/functions/_shared/ai-agent-orchestrator.ts (Deno)
 * - supabase/functions/wa-webhook/shared/agent_orchestrator.ts (Deno)
 *
 * @see docs/AI_AGENT_ARCHITECTURE.md for detailed documentation
 * @packageDocumentation
 */

import type { TokenUsage } from '../types/index';

// ============================================================================
// ORCHESTRATOR INTERFACE
// ============================================================================

/**
 * Agent types supported by the orchestrator
 */
export type OrchestratorAgentType =
  | 'waiter'           // Restaurant/bar ordering
  | 'rides'            // Mobility coordination
  | 'jobs'             // Job board and gigs
  | 'business_broker'  // Find nearby businesses
  | 'real_estate'      // Property rentals
  | 'farmer'           // Produce listing
  | 'insurance'        // Quotes, claims, policies
  | 'sales'            // SDR for EasyMO
  | 'support'          // Customer support
  | 'pharmacy'         // Medicine finder
  | 'wallet'           // Wallet & payments
  | 'general'          // Fallback/triage
  | 'triage';          // Initial routing

/**
 * Common parameters for processing a message
 */
export interface ProcessMessageParams {
  /** User identifier (phone number or UUID) */
  userId: string;
  /** The message content to process */
  message: string;
  /** Optional existing conversation ID */
  conversationId?: string;
  /** Optional context for the conversation */
  context?: Record<string, unknown>;
  /** Optional correlation ID for tracing */
  correlationId?: string;
}

/**
 * Result of intent classification
 */
export interface IntentResult {
  /** The classified agent type */
  agentType: OrchestratorAgentType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Optional intent details */
  intentType?: string;
  /** Optional extracted entities */
  entities?: Record<string, unknown>;
}

/**
 * Response from agent processing
 */
export interface OrchestratorResponse {
  /** The agent's text response */
  message: string;
  /** Type of agent that handled the request */
  agentType: OrchestratorAgentType;
  /** Token usage statistics */
  usage?: TokenUsage;
  /** Cost in USD */
  costUsd?: number;
  /** Processing latency in milliseconds */
  latencyMs?: number;
  /** Model used for response */
  model?: string;
  /** List of tools executed */
  toolsExecuted?: string[];
  /** Optional session data to persist */
  sessionData?: Record<string, unknown>;
  /** Optional suggested next agent for handoff */
  suggestedNextAgent?: OrchestratorAgentType;
}

/**
 * Unified interface for all AgentOrchestrator implementations
 *
 * This interface defines the contract that all orchestrator implementations
 * must follow, whether they run in Node.js or Deno environments.
 */
export interface IAgentOrchestrator {
  /**
   * Process an incoming message and return an agent response
   *
   * @param params - Message processing parameters
   * @returns Promise resolving to the agent's response
   */
  processMessage(params: ProcessMessageParams): Promise<OrchestratorResponse>;

  /**
   * Classify the intent of a message and determine which agent should handle it
   *
   * @param message - The user's message
   * @param context - Optional context for classification
   * @returns Promise resolving to intent classification result
   */
  classifyIntent(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<IntentResult>;

  /**
   * Transfer a conversation to a different agent
   *
   * @param conversationId - The conversation to transfer
   * @param targetAgent - The agent to transfer to
   */
  transferToAgent?(
    conversationId: string,
    targetAgent: OrchestratorAgentType,
  ): Promise<void>;

  /**
   * End a conversation and cleanup resources
   *
   * @param conversationId - The conversation to end
   */
  endConversation?(conversationId: string): Promise<void>;

  /**
   * Health check for the orchestrator
   *
   * @returns Promise resolving to health status
   */
  healthCheck?(): Promise<{
    healthy: boolean;
    providers: Record<string, boolean>;
  }>;
}

// ============================================================================
// PROVIDER INTERFACE (for Node.js packages/ai)
// ============================================================================

/**
 * Message format for AI providers
 */
export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

/**
 * Tool definition for AI providers
 */
export interface ProviderToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Tool call from AI provider
 */
export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Options for provider chat completion
 */
export interface ProviderChatOptions {
  model: string;
  messages: ProviderMessage[];
  systemPrompt?: string;
  tools?: ProviderToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  userId?: string;
}

/**
 * Response from provider chat completion
 */
export interface ProviderChatResponse {
  content: string;
  toolCalls?: ProviderToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason?: string;
}

/**
 * Unified interface for AI providers
 *
 * This abstracts away the differences between OpenAI, Gemini, and other
 * AI providers, allowing for transparent switching and failover.
 */
export interface IAIProvider {
  /** Provider name (e.g., 'openai', 'gemini') */
  readonly name: string;

  /** List of supported models */
  readonly supportedModels: string[];

  /**
   * Send a chat completion request
   *
   * @param options - Chat completion options
   * @returns Promise resolving to chat response
   */
  chat(options: ProviderChatOptions): Promise<ProviderChatResponse>;

  /**
   * Generate embeddings for semantic search
   *
   * @param text - Text to embed
   * @param model - Optional embedding model
   * @returns Promise resolving to embedding vector
   */
  embeddings(text: string, model?: string): Promise<number[]>;

  /**
   * Analyze an image with vision capabilities
   *
   * @param imageUrl - URL of the image
   * @param prompt - Analysis prompt
   * @returns Promise resolving to analysis text
   */
  analyzeImage?(imageUrl: string, prompt: string): Promise<string>;

  /**
   * Health check for the provider
   *
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// FALLBACK PROVIDER INTERFACE
// ============================================================================

/**
 * Configuration for fallback provider
 */
export interface FallbackProviderConfig {
  /** Primary provider to use first */
  primary: IAIProvider;
  /** Fallback provider if primary fails */
  fallback: IAIProvider;
  /** Maximum retries before failing over */
  maxRetries?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Factory function type for creating providers
 */
export type ProviderFactory = (
  apiKey: string,
  correlationId?: string,
) => IAIProvider;

// ============================================================================
// AGENT CONFIGURATION INTERFACE
// ============================================================================

/**
 * Configuration for an individual agent
 */
export interface AgentConfiguration {
  /** Agent identifier */
  id: string;
  /** Agent type */
  type: OrchestratorAgentType;
  /** Display name */
  name: string;
  /** System prompt/instructions */
  systemPrompt: string;
  /** LLM temperature (0-1) */
  temperature: number;
  /** Maximum response tokens */
  maxTokens: number;
  /** List of enabled tool names */
  enabledTools: string[];
  /** Routing priority (higher = more priority) */
  priority: number;
  /** Keywords that trigger this agent */
  triggers: string[];
  /** Whether agent is active */
  isActive: boolean;
  /** Primary AI provider */
  primaryProvider: 'openai' | 'gemini';
  /** Fallback AI provider */
  fallbackProvider?: 'openai' | 'gemini';
  /** Provider-specific configuration */
  providerConfig?: {
    openai?: { model: string; temperature?: number; maxTokens?: number };
    gemini?: { model: string; temperature?: number; maxTokens?: number };
  };
}

// ============================================================================
// METRICS AND MONITORING INTERFACE
// ============================================================================

/**
 * Metrics for a single agent interaction
 */
export interface AgentInteractionMetrics {
  /** Session ID */
  sessionId: string;
  /** Agent type */
  agentType: OrchestratorAgentType;
  /** Processing latency in milliseconds */
  latencyMs: number;
  /** Input tokens used */
  tokensIn: number;
  /** Output tokens used */
  tokensOut: number;
  /** Cost in USD */
  costUsd: number;
  /** Whether the interaction succeeded */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
  /** Timestamp */
  timestamp: Date;
  /** Model used */
  model?: string;
  /** Tools executed */
  toolsExecuted?: string[];
}
