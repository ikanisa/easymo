/**
 * Gemini Provider for Unified AI Interface
 *
 * Implements the IUnifiedAIProvider interface for Google's Gemini models.
 * Supports Gemini 2.5 Pro, Flash, Flash-Lite, and multimodal capabilities.
 *
 * @packageDocumentation
 */

import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';

import { childLogger } from '@easymo/commons';

import type {
  IUnifiedAIProvider,
  ProviderHealthStatus,
  UnifiedChatConfig,
  UnifiedChatResponse,
  UnifiedMessage,
  UnifiedStreamChunk,
  UnifiedTokenUsage,
} from '../core/unified-provider.js';
import { calculateCost } from '../core/unified-provider.js';

const log = childLogger({ service: 'gemini-provider' });

/**
 * Configuration for Gemini Provider
 */
export interface GeminiProviderConfig {
  apiKey: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Model name mapping for Gemini
 */
const GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-2.5-pro': 'gemini-2.5-pro-latest',
  'gemini-2.5-flash': 'gemini-2.5-flash-latest',
  'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash': 'gemini-2.0-flash-exp',
  'gemini-1.5-pro': 'gemini-1.5-pro-latest',
  'gemini-1.5-flash': 'gemini-1.5-flash-latest',
};

/**
 * Resolve model name to actual Gemini model identifier
 */
function resolveModelName(model: string): string {
  return GEMINI_MODEL_MAP[model] || model;
}

/**
 * Convert unified messages to Gemini format
 */
function toGeminiMessages(
  messages: UnifiedMessage[],
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return messages
    .filter((m) => m.role !== 'system' && m.content)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));
}

/**
 * Extract system instruction from messages
 */
function extractSystemInstruction(messages: UnifiedMessage[]): string | undefined {
  const systemMessage = messages.find((m) => m.role === 'system');
  return systemMessage?.content || undefined;
}

/**
 * Convert unified tools to Gemini function declarations
 */
function toGeminiFunctionDeclarations(
  tools: UnifiedChatConfig['tools'],
): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.parameters || {},
    },
  }));
}

/**
 * GeminiProvider - Implementation of IUnifiedAIProvider for Gemini
 */
export class GeminiProvider implements IUnifiedAIProvider {
  readonly name: 'gemini' = 'gemini';
  readonly supportedModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];

  private client: GoogleGenerativeAI;
  private config: Required<GeminiProviderConfig>;

  constructor(config: GeminiProviderConfig) {
    this.config = {
      apiKey: config.apiKey,
      defaultModel: config.defaultModel || 'gemini-2.5-flash',
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
    };
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Get a Gemini model instance
   */
  private getModel(
    modelName: string,
    config?: { temperature?: number; maxTokens?: number; topP?: number },
  ): GenerativeModel {
    return this.client.getGenerativeModel({
      model: resolveModelName(modelName),
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 8192,
        topP: config?.topP ?? 0.95,
      },
    });
  }

  /**
   * Chat completion
   */
  async chat(
    messages: UnifiedMessage[],
    config?: UnifiedChatConfig,
  ): Promise<UnifiedChatResponse> {
    const startTime = Date.now();
    const modelName = config?.model || this.config.defaultModel;

    try {
      const model = this.getModel(modelName, {
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        topP: config?.topP,
      });

      const systemInstruction = extractSystemInstruction(messages);
      const history = toGeminiMessages(messages.slice(0, -1));
      const lastMessage = messages[messages.length - 1];

      // Start chat with function declarations if tools provided
      // Note: Type assertion needed because the Gemini SDK's Tool type is stricter
      // than our generic tool definitions. The runtime behavior is correct.
      const geminiTools = toGeminiFunctionDeclarations(config?.tools);
      const startChatParams: Parameters<typeof model.startChat>[0] = {
        history,
        systemInstruction: systemInstruction || undefined,
      };
      if (geminiTools && geminiTools.length > 0) {
        // The SDK expects FunctionDeclaration[] with specific schema types,
        // but our generic Record<string, unknown> is compatible at runtime
        (startChatParams as Record<string, unknown>).tools = [{ functionDeclarations: geminiTools }];
      }
      const chat = model.startChat(startChatParams);

      const result = await chat.sendMessage(lastMessage.content || '');
      const response = result.response;
      const text = response.text();
      const latencyMs = Date.now() - startTime;

      // Extract usage metadata (Gemini provides this differently)
      const usageMetadata = response.usageMetadata;
      const usage: UnifiedTokenUsage = {
        promptTokens: usageMetadata?.promptTokenCount || 0,
        completionTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0,
      };

      // Handle function calls
      const functionCalls = response.functionCalls();
      const toolCalls = functionCalls?.map((fc) => ({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: fc.name,
        arguments: fc.args as Record<string, unknown>,
      }));

      const costUsd = calculateCost(usage.promptTokens, usage.completionTokens, modelName);

      return {
        content: text,
        toolCalls,
        usage,
        model: modelName,
        provider: 'gemini',
        finishReason: response.candidates?.[0]?.finishReason || undefined,
        latencyMs,
        costUsd,
      };
    } catch (error) {
      log.error(
        {
          event: 'GEMINI_CHAT_ERROR',
          model: modelName,
          error: error instanceof Error ? error.message : String(error),
        },
        'Gemini chat failed',
      );
      throw error;
    }
  }

  /**
   * Stream chat completion
   */
  async *stream(
    messages: UnifiedMessage[],
    config?: UnifiedChatConfig,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const modelName = config?.model || this.config.defaultModel;

    try {
      const model = this.getModel(modelName, {
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        topP: config?.topP,
      });

      const systemInstruction = extractSystemInstruction(messages);
      const history = toGeminiMessages(messages.slice(0, -1));
      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({
        history,
        // SystemInstruction in Gemini SDK can be a string
        systemInstruction: systemInstruction || undefined,
      });

      const result = await chat.sendMessageStream(lastMessage.content || '');

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            delta: text,
            done: false,
          };
        }
      }

      // Final chunk with usage
      const response = await result.response;
      const usageMetadata = response.usageMetadata;

      yield {
        delta: null,
        done: true,
        usage: {
          promptTokens: usageMetadata?.promptTokenCount || 0,
          completionTokens: usageMetadata?.candidatesTokenCount || 0,
          totalTokens: usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      log.error(
        {
          event: 'GEMINI_STREAM_ERROR',
          model: modelName,
          error: error instanceof Error ? error.message : String(error),
        },
        'Gemini stream failed',
      );
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async embeddings(text: string, model?: string): Promise<number[]> {
    const embeddingModel = model || 'text-embedding-004';
    try {
      const geminiModel = this.client.getGenerativeModel({ model: embeddingModel });
      const result = await geminiModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      log.error(
        {
          event: 'GEMINI_EMBEDDING_ERROR',
          error: error instanceof Error ? error.message : String(error),
        },
        'Gemini embedding failed',
      );
      throw error;
    }
  }

  /**
   * Analyze image with vision
   */
  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      const model = this.getModel('gemini-2.0-flash');

      // Determine if it's a data URL (base64) or a regular URL
      let imagePart: { inlineData: { mimeType: string; data: string } } | { text: string };
      
      if (imageUrl.startsWith('data:')) {
        // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
        const mimeMatch = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!mimeMatch) {
          throw new Error('Invalid data URL format');
        }
        imagePart = {
          inlineData: {
            mimeType: mimeMatch[1],
            data: mimeMatch[2],
          },
        };
      } else {
        // For regular URLs, we need to describe the image request
        // Note: Gemini may not support direct URL loading in all cases
        // Consider fetching the image and converting to base64 for reliability
        imagePart = { text: `[Image from URL: ${imageUrl}]` };
      }

      const parts = [{ text: prompt }, imagePart];
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (error) {
      log.error(
        {
          event: 'GEMINI_VISION_ERROR',
          error: error instanceof Error ? error.message : String(error),
        },
        'Gemini vision failed',
      );
      throw error;
    }
  }

  /**
   * Speech to text using Gemini multimodal
   */
  async speechToText(
    audio: Buffer | string,
    config?: { language?: string; format?: string },
  ): Promise<string> {
    try {
      const model = this.getModel('gemini-2.5-flash');
      const audioBase64 = typeof audio === 'string' ? audio : audio.toString('base64');
      const mimeType = config?.format || 'audio/wav';

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: config?.language
            ? `Transcribe this audio in ${config.language}. Return only the transcription.`
            : 'Transcribe this audio. Return only the transcription.',
        },
      ]);

      return result.response.text();
    } catch (error) {
      log.error(
        {
          event: 'GEMINI_STT_ERROR',
          error: error instanceof Error ? error.message : String(error),
        },
        'Gemini speech-to-text failed',
      );
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    try {
      const model = this.getModel('gemini-2.5-flash');
      await model.generateContent('test');
      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Fast response using Flash-Lite model
   */
  async fastResponse(
    prompt: string,
    config?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const model = this.getModel('gemini-2.5-flash-lite', {
      temperature: config?.temperature ?? 0.1,
      maxTokens: config?.maxTokens ?? 256,
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

/**
 * Create a Gemini provider instance
 */
export function createGeminiProvider(config: GeminiProviderConfig): GeminiProvider {
  return new GeminiProvider(config);
}
