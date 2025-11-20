/**
 * OpenAI LLM Provider Implementation
 * 
 * Wraps OpenAI API with the standard LLM Provider interface
 */

import OpenAI from "npm:openai@^4.24.0";
import { logStructuredEvent, logError, recordMetric } from "./observability.ts";
import type {
  LLMProvider,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMToolDefinition,
  LLMToolCall,
} from "./llm-provider-interface.ts";

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly supportedModels = [
    'gpt-4-turbo-preview',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-4-vision-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ];

  private client: OpenAI;
  private correlationId?: string;

  constructor(apiKey?: string, correlationId?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || Deno.env.get("OPENAI_API_KEY"),
    });
    this.correlationId = correlationId;
  }

  async chat(options: LLMCompletionOptions): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    
    try {
      logStructuredEvent("OPENAI_CHAT_REQUEST", {
        model: options.model,
        messageCount: options.messages.length,
        hasTools: !!options.tools,
        correlationId: this.correlationId,
      });

      // Build messages array
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      if (options.system) {
        messages.push({
          role: 'system',
          content: options.system,
        });
      }
      
      messages.push(...options.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })));

      // Convert tools to OpenAI format
      const tools = options.tools?.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));

      // Make API call
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages,
        tools,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Extract tool calls if present
      const toolCalls: LLMToolCall[] | undefined = message.tool_calls?.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      const duration = Date.now() - startTime;

      logStructuredEvent("OPENAI_CHAT_COMPLETE", {
        model: response.model,
        tokensUsed: response.usage?.total_tokens,
        durationMs: duration,
        hasToolCalls: !!toolCalls,
        correlationId: this.correlationId,
      });

      recordMetric("llm.chat.request", 1, {
        provider: "openai",
        model: options.model,
        duration_ms: duration,
      });

      return {
        content: message.content || '',
        toolCalls,
        metadata: {
          model: response.model,
          provider: 'openai',
          tokensUsed: response.usage ? {
            prompt: response.usage.prompt_tokens,
            completion: response.usage.completion_tokens,
            total: response.usage.total_tokens,
          } : undefined,
          finishReason: choice.finish_reason,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError("openai_chat_error", error, {
        model: options.model,
        durationMs: duration,
        correlationId: this.correlationId,
      });

      recordMetric("llm.chat.error", 1, {
        provider: "openai",
        model: options.model,
      });

      throw error;
    }
  }

  async embeddings(text: string, model = 'text-embedding-3-small'): Promise<number[]> {
    try {
      logStructuredEvent("OPENAI_EMBEDDINGS_REQUEST", {
        model,
        textLength: text.length,
        correlationId: this.correlationId,
      });

      const response = await this.client.embeddings.create({
        model,
        input: text,
      });

      recordMetric("llm.embeddings.request", 1, {
        provider: "openai",
        model,
      });

      return response.data[0].embedding;

    } catch (error) {
      logError("openai_embeddings_error", error, {
        model,
        correlationId: this.correlationId,
      });

      recordMetric("llm.embeddings.error", 1, {
        provider: "openai",
        model,
      });

      throw error;
    }
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      logStructuredEvent("OPENAI_VISION_REQUEST", {
        imageUrl: imageUrl.substring(0, 100),
        promptLength: prompt.length,
        correlationId: this.correlationId,
      });

      const response = await this.client.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
      });

      recordMetric("llm.vision.request", 1, {
        provider: "openai",
      });

      return response.choices[0].message.content || '';

    } catch (error) {
      logError("openai_vision_error", error, {
        correlationId: this.correlationId,
      });

      recordMetric("llm.vision.error", 1, {
        provider: "openai",
      });

      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to check API health
      await this.client.models.list();
      return true;
    } catch (error) {
      logError("openai_health_check_failed", error, {
        correlationId: this.correlationId,
      });
      return false;
    }
  }
}
