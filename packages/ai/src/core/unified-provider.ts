/**
 * Unified AI Provider Interface
 *
 * Provides a common interface for all AI providers (OpenAI, Gemini)
 * with automatic fallback, cost-based routing, and capability-based selection.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'unified-provider' });

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Message format for unified provider
 */
export interface UnifiedMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  name?: string;
  toolCallId?: string;
}

/**
 * Multi-modal message content
 */
export interface MultiModalContent {
  type: 'text' | 'image' | 'audio';
  text?: string;
  image?: string; // Base64 or URL
  audio?: string; // Base64
  mimeType?: string;
}

/**
 * Multi-modal message for unified provider
 */
export interface MultiModalMessage {
  role: 'user' | 'assistant' | 'system';
  content: MultiModalContent[];
}

/**
 * Tool definition for unified provider
 */
export interface UnifiedToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Tool call result from provider
 */
export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Token usage statistics
 */
export interface UnifiedTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Chat completion configuration
 */
export interface UnifiedChatConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  tools?: UnifiedToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required';
  responseFormat?: 'text' | 'json';
  userId?: string;
  correlationId?: string;
}

/**
 * Chat completion response
 */
export interface UnifiedChatResponse {
  content: string | null;
  toolCalls?: UnifiedToolCall[];
  usage: UnifiedTokenUsage;
  model: string;
  provider: 'openai' | 'gemini';
  finishReason?: string;
  latencyMs: number;
  costUsd: number;
}

/**
 * Stream chunk from provider
 */
export interface UnifiedStreamChunk {
  delta: string | null;
  toolCall?: Partial<UnifiedToolCall>;
  done: boolean;
  usage?: UnifiedTokenUsage;
}

/**
 * Provider health status
 */
export interface ProviderHealthStatus {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  lastChecked: Date;
}

// ============================================================================
// UNIFIED PROVIDER INTERFACE
// ============================================================================

/**
 * Unified interface for AI providers
 *
 * This abstracts away the differences between OpenAI, Gemini, and other
 * AI providers, allowing for transparent switching and failover.
 */
export interface IUnifiedAIProvider {
  /** Provider name */
  readonly name: 'openai' | 'gemini';

  /** List of supported models */
  readonly supportedModels: string[];

  /**
   * Send a chat completion request
   */
  chat(
    messages: UnifiedMessage[],
    config?: UnifiedChatConfig,
  ): Promise<UnifiedChatResponse>;

  /**
   * Stream a chat completion
   */
  stream(
    messages: UnifiedMessage[],
    config?: UnifiedChatConfig,
  ): AsyncIterable<UnifiedStreamChunk>;

  /**
   * Generate an image from a prompt
   */
  generateImage?(
    prompt: string,
    config?: { size?: string; quality?: string; style?: string },
  ): Promise<string>;

  /**
   * Transcribe audio to text (speech-to-text)
   */
  speechToText?(
    audio: Buffer | string,
    config?: { language?: string; format?: string },
  ): Promise<string>;

  /**
   * Convert text to speech (text-to-speech)
   */
  textToSpeech?(
    text: string,
    config?: { voice?: string; speed?: number; format?: string },
  ): Promise<Buffer>;

  /**
   * Generate embeddings for text
   */
  embeddings(text: string, model?: string): Promise<number[]>;

  /**
   * Analyze an image with vision capabilities
   */
  analyzeImage?(imageUrl: string, prompt: string): Promise<string>;

  /**
   * Health check for the provider
   */
  healthCheck(): Promise<ProviderHealthStatus>;
}

// ============================================================================
// UNIFIED PROVIDER CONFIGURATION
// ============================================================================

/**
 * Configuration for unified provider
 */
export interface UnifiedProviderConfig {
  /** OpenAI API key */
  openaiApiKey?: string;
  /** Gemini API key */
  geminiApiKey?: string;
  /** Primary provider (default: openai) */
  primaryProvider?: 'openai' | 'gemini';
  /** Enable automatic fallback */
  enableFallback?: boolean;
  /** Timeout before fallback (ms) */
  fallbackTimeoutMs?: number;
  /** Maximum retries before fallback */
  maxRetries?: number;
  /** Enable cost-based routing */
  enableCostRouting?: boolean;
  /** Correlation ID for tracing */
  correlationId?: string;
}

// ============================================================================
// COST CALCULATOR
// ============================================================================

/**
 * Model pricing (per 1M tokens as of Nov 2024)
 */
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  // OpenAI models
  'gpt-4o': { prompt: 2.5, completion: 10 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'gpt-4-turbo': { prompt: 10, completion: 30 },
  'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
  // Gemini models
  'gemini-2.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-2.5-flash': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.5-flash-lite': { prompt: 0.000075, completion: 0.0003 },
  'gemini-2.0-flash': { prompt: 0.0001, completion: 0.0004 },
  'gemini-1.5-pro': { prompt: 0.00125, completion: 0.005 },
  'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
};

/**
 * Calculate cost for token usage
 */
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string,
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o'];
  return (
    (promptTokens / 1_000_000) * pricing.prompt +
    (completionTokens / 1_000_000) * pricing.completion
  );
}

/**
 * Select the most cost-effective model for a task
 */
export function selectCostEffectiveModel(
  task: 'simple' | 'complex' | 'vision' | 'fast',
  provider: 'openai' | 'gemini',
): string {
  if (provider === 'gemini') {
    switch (task) {
      case 'simple':
      case 'fast':
        return 'gemini-2.5-flash-lite';
      case 'vision':
        return 'gemini-2.0-flash';
      case 'complex':
        return 'gemini-2.5-pro';
      default:
        return 'gemini-2.5-flash';
    }
  }

  // OpenAI
  switch (task) {
    case 'simple':
    case 'fast':
      return 'gpt-4o-mini';
    case 'vision':
    case 'complex':
      return 'gpt-4o';
    default:
      return 'gpt-4o-mini';
  }
}

// ============================================================================
// UNIFIED AI PROVIDER IMPLEMENTATION
// ============================================================================

/**
 * UnifiedAIProvider - Single entry point for all AI operations
 *
 * Provides automatic fallback, cost-based routing, and capability-based
 * model selection across OpenAI and Gemini providers.
 */
export class UnifiedAIProvider extends EventEmitter {
  private config: Required<UnifiedProviderConfig>;
  private openai: IUnifiedAIProvider | null = null;
  private gemini: IUnifiedAIProvider | null = null;
  private providerHealth: Map<string, ProviderHealthStatus> = new Map();

  constructor(config: UnifiedProviderConfig) {
    super();
    this.config = {
      openaiApiKey: config.openaiApiKey || '',
      geminiApiKey: config.geminiApiKey || '',
      primaryProvider: config.primaryProvider || 'openai',
      enableFallback: config.enableFallback ?? true,
      fallbackTimeoutMs: config.fallbackTimeoutMs || 30000,
      maxRetries: config.maxRetries || 1,
      enableCostRouting: config.enableCostRouting ?? false,
      correlationId: config.correlationId || '',
    };
  }

  /**
   * Register an OpenAI provider instance
   */
  registerOpenAI(provider: IUnifiedAIProvider): void {
    this.openai = provider;
  }

  /**
   * Register a Gemini provider instance
   */
  registerGemini(provider: IUnifiedAIProvider): void {
    this.gemini = provider;
  }

  /**
   * Get the primary provider
   */
  private getPrimaryProvider(): IUnifiedAIProvider | null {
    return this.config.primaryProvider === 'openai' ? this.openai : this.gemini;
  }

  /**
   * Get the fallback provider
   */
  private getFallbackProvider(): IUnifiedAIProvider | null {
    return this.config.primaryProvider === 'openai' ? this.gemini : this.openai;
  }

  /**
   * Chat completion with automatic fallback
   */
  async chat(
    messages: UnifiedMessage[],
    config?: UnifiedChatConfig,
  ): Promise<UnifiedChatResponse> {
    const primary = this.getPrimaryProvider();
    const fallback = this.getFallbackProvider();

    if (!primary) {
      throw new Error('No primary provider configured');
    }

    // Select model based on cost routing if enabled
    let effectiveConfig = { ...config };
    if (this.config.enableCostRouting && !config?.model) {
      effectiveConfig.model = selectCostEffectiveModel(
        'simple',
        this.config.primaryProvider,
      );
    }

    let lastError: Error | null = null;
    let attempts = 0;

    // Try primary provider
    while (attempts <= this.config.maxRetries) {
      try {
        const response = await Promise.race([
          primary.chat(messages, effectiveConfig),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Timeout')),
              this.config.fallbackTimeoutMs,
            ),
          ),
        ]);

        log.info(
          {
            event: 'CHAT_COMPLETION',
            provider: primary.name,
            model: response.model,
            latencyMs: response.latencyMs,
            costUsd: response.costUsd,
            correlationId: this.config.correlationId,
          },
          'Chat completion succeeded',
        );

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;
        log.warn(
          {
            event: 'CHAT_ATTEMPT_FAILED',
            provider: primary.name,
            attempt: attempts,
            error: lastError.message,
            correlationId: this.config.correlationId,
          },
          'Chat attempt failed',
        );
      }
    }

    // Try fallback provider if enabled
    if (this.config.enableFallback && fallback) {
      try {
        log.info(
          {
            event: 'FALLING_BACK',
            from: primary.name,
            to: fallback.name,
            correlationId: this.config.correlationId,
          },
          'Falling back to secondary provider',
        );

        // Update model for fallback provider
        if (this.config.enableCostRouting && !config?.model) {
          effectiveConfig.model = selectCostEffectiveModel(
            'simple',
            fallback.name as 'openai' | 'gemini',
          );
        }

        const response = await fallback.chat(messages, effectiveConfig);

        log.info(
          {
            event: 'FALLBACK_SUCCESS',
            provider: fallback.name,
            model: response.model,
            latencyMs: response.latencyMs,
            correlationId: this.config.correlationId,
          },
          'Fallback succeeded',
        );

        return response;
      } catch (fallbackError) {
        log.error(
          {
            event: 'FALLBACK_FAILED',
            provider: fallback.name,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            correlationId: this.config.correlationId,
          },
          'Fallback also failed',
        );
      }
    }

    // All attempts failed
    throw lastError || new Error('All providers failed');
  }

  /**
   * Stream chat completion with automatic fallback
   */
  async *stream(
    messages: UnifiedMessage[],
    config?: UnifiedChatConfig,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const primary = this.getPrimaryProvider();
    const fallback = this.getFallbackProvider();

    if (!primary) {
      throw new Error('No primary provider configured');
    }

    try {
      for await (const chunk of primary.stream(messages, config)) {
        yield chunk;
      }
    } catch (error) {
      if (this.config.enableFallback && fallback) {
        log.warn(
          {
            event: 'STREAM_FALLBACK',
            from: primary.name,
            to: fallback.name,
            correlationId: this.config.correlationId,
          },
          'Streaming falling back',
        );

        for await (const chunk of fallback.stream(messages, config)) {
          yield chunk;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate image (routes to appropriate provider)
   */
  async generateImage(
    prompt: string,
    config?: { size?: string; quality?: string; style?: string },
  ): Promise<string> {
    // OpenAI DALL-E is primary for image generation
    if (this.openai?.generateImage) {
      return this.openai.generateImage(prompt, config);
    }
    if (this.gemini?.generateImage) {
      return this.gemini.generateImage(prompt, config);
    }
    throw new Error('No image generation provider configured');
  }

  /**
   * Speech to text (routes to appropriate provider)
   */
  async speechToText(
    audio: Buffer | string,
    config?: { language?: string; format?: string },
  ): Promise<string> {
    // OpenAI Whisper is primary for STT
    if (this.openai?.speechToText) {
      return this.openai.speechToText(audio, config);
    }
    if (this.gemini?.speechToText) {
      return this.gemini.speechToText(audio, config);
    }
    throw new Error('No speech-to-text provider configured');
  }

  /**
   * Text to speech (routes to appropriate provider)
   */
  async textToSpeech(
    text: string,
    config?: { voice?: string; speed?: number; format?: string },
  ): Promise<Buffer> {
    // OpenAI TTS is primary
    if (this.openai?.textToSpeech) {
      return this.openai.textToSpeech(text, config);
    }
    if (this.gemini?.textToSpeech) {
      return this.gemini.textToSpeech(text, config);
    }
    throw new Error('No text-to-speech provider configured');
  }

  /**
   * Generate embeddings
   */
  async embeddings(text: string, model?: string): Promise<number[]> {
    const primary = this.getPrimaryProvider();
    if (!primary) {
      throw new Error('No primary provider configured');
    }
    return primary.embeddings(text, model);
  }

  /**
   * Analyze image with vision
   */
  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    // Gemini is better for vision tasks
    if (this.gemini?.analyzeImage) {
      return this.gemini.analyzeImage(imageUrl, prompt);
    }
    if (this.openai?.analyzeImage) {
      return this.openai.analyzeImage(imageUrl, prompt);
    }
    throw new Error('No vision provider configured');
  }

  /**
   * Fast response using lightweight model
   */
  async fastResponse(
    messages: UnifiedMessage[],
    config?: Omit<UnifiedChatConfig, 'model'>,
  ): Promise<UnifiedChatResponse> {
    // Gemini Flash-Lite for fastest responses
    if (this.gemini) {
      return this.gemini.chat(messages, {
        ...config,
        model: 'gemini-2.5-flash-lite',
        temperature: 0.1,
        maxTokens: 256,
      });
    }
    // Fallback to GPT-4o-mini
    if (this.openai) {
      return this.openai.chat(messages, {
        ...config,
        model: 'gpt-4o-mini',
        temperature: 0.1,
        maxTokens: 256,
      });
    }
    throw new Error('No provider configured for fast response');
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    providers: Record<string, ProviderHealthStatus>;
  }> {
    const results: Record<string, ProviderHealthStatus> = {};

    if (this.openai) {
      results.openai = await this.openai.healthCheck();
      this.providerHealth.set('openai', results.openai);
    }

    if (this.gemini) {
      results.gemini = await this.gemini.healthCheck();
      this.providerHealth.set('gemini', results.gemini);
    }

    const healthy = Object.values(results).some((r) => r.healthy);

    return { healthy, providers: results };
  }
}

/**
 * Create a unified AI provider with default configuration
 */
export function createUnifiedProvider(
  config: UnifiedProviderConfig,
): UnifiedAIProvider {
  return new UnifiedAIProvider(config);
}
