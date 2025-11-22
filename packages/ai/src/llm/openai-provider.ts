import { EventEmitter } from 'events';
import OpenAI from 'openai';
import type { 
  ChatCompletionChunk,
  ChatCompletionMessageParam, 
  ChatCompletionTool} from 'openai/resources/chat/completions';
import { z } from 'zod';

import type { AgentResponse, ExecutionMetrics, Message, StreamChunk,TokenUsage, ToolCall } from '../types/index.js';

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
}

export class OpenAIProvider extends EventEmitter {
  private client: OpenAI;
  private config: OpenAIConfig;
  
  constructor(config: OpenAIConfig) {
    super();
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 60000,
    });
  }

  /**
   * Chat completion with function calling
   */
  async chat(params: {
    messages: ChatCompletionMessageParam[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: ChatCompletionTool[];
    toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
    responseFormat?: { type: 'text' | 'json_object' };
    stream?: false;
    seed?: number;
    user?: string;
  }): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      const completion = await this.client.chat.completions.create({
        model: params.model || this.config.defaultModel || 'gpt-4o',
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        tools: params.tools,
        tool_choice: params.toolChoice,
        response_format: params.responseFormat,
        seed: params.seed,
        user: params.user,
        stream: false,
      });

      const llmLatencyMs = Date.now() - startTime;
      const choice = completion.choices[0];
      const message = choice.message;

      // Extract tool calls if present
      const toolCalls: ToolCall[] = message.tool_calls?.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })) || [];

      // Create response message
      const responseMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        conversationId: '', // Will be set by caller
        role: 'assistant',
        content: message.content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: new Date(),
        tokens: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        latency: llmLatencyMs,
      };

      // Calculate cost
      const costUsd = this.calculateCost(
        completion.usage?.prompt_tokens || 0,
        completion.usage?.completion_tokens || 0,
        params.model || 'gpt-4o'
      );

      return {
        message: responseMessage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: responseMessage.tokens,
        metrics: {
          latencyMs: llmLatencyMs,
          llmLatencyMs,
          costUsd,
          tokensPerSecond: (completion.usage?.completion_tokens || 0) / (llmLatencyMs / 1000),
        },
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Streaming chat completion
   */
  async *streamChat(params: {
    messages: ChatCompletionMessageParam[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: ChatCompletionTool[];
    toolChoice?: 'none' | 'auto' | 'required';
    responseFormat?: { type: 'text' | 'json_object' };
    seed?: number;
    user?: string;
  }): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();
    
    try {
      const stream = await this.client.chat.completions.create({
        model: params.model || this.config.defaultModel || 'gpt-4o',
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        tools: params.tools,
        tool_choice: params.toolChoice,
        response_format: params.responseFormat,
        seed: params.seed,
        user: params.user,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      });

      let fullContent = '';
      const toolCallsInProgress = new Map<number, Partial<ToolCall>>();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        
        if (!choice) continue;

        // Handle content delta
        if (choice.delta?.content) {
          fullContent += choice.delta.content;
          yield {
            delta: choice.delta.content,
            done: false,
          };
        }

        // Handle tool calls
        if (choice.delta?.tool_calls) {
          for (const toolCallDelta of choice.delta.tool_calls) {
            const index = toolCallDelta.index;
            
            if (!toolCallsInProgress.has(index)) {
              toolCallsInProgress.set(index, {
                id: toolCallDelta.id!,
                type: 'function',
                function: {
                  name: toolCallDelta.function?.name || '',
                  arguments: '',
                },
              });
            }

            const toolCall = toolCallsInProgress.get(index)!;
            
            if (toolCallDelta.function?.name) {
              toolCall.function!.name = toolCallDelta.function.name;
            }
            
            if (toolCallDelta.function?.arguments) {
              toolCall.function!.arguments += toolCallDelta.function.arguments;
            }

            yield {
              delta: null,
              toolCall,
              done: false,
            };
          }
        }

        // Handle usage (final chunk)
        if (chunk.usage) {
          yield {
            delta: null,
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
            done: true,
          };
        }
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  async generateEmbeddings(texts: string[], model: string = 'text-embedding-3-small'): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model,
        input: texts,
        encoding_format: 'float',
      });

      return response.data.map(d => d.embedding);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Calculate API cost based on OpenAI pricing
   */
  private calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    // Pricing per 1M tokens (as of Nov 2024)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4o': { prompt: 2.50, completion: 10.00 },
      'gpt-4o-mini': { prompt: 0.150, completion: 0.600 },
      'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
      'gpt-3.5-turbo': { prompt: 0.500, completion: 1.500 },
      'gpt-4': { prompt: 30.00, completion: 60.00 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o'];
    
    return (
      (promptTokens / 1000000) * modelPricing.prompt +
      (completionTokens / 1000000) * modelPricing.completion
    );
  }

  /**
   * Moderate content using OpenAI moderation API
   */
  async moderateContent(text: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    scores: Record<string, number>;
  }> {
    try {
      const response = await this.client.moderations.create({
        input: text,
      });

      const result = response.results[0];

      return {
        flagged: result.flagged,
        categories: result.categories as Record<string, boolean>,
        scores: result.category_scores as Record<string, number>,
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}
