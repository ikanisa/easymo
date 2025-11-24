/**
 * OpenAI Client for wa-webhook
 *
 * Provides OpenAI API integration with:
 * - Chat completions with function calling
 * - Streaming support
 * - Token usage tracking
 * - Cost calculation
 * - Error handling & retries
 */

import { OPENAI_API_KEY } from "../config.ts";
import { logStructuredEvent } from "../observe/log.ts";

/**
 * Safely extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: Tool[];
  tool_choice?: "none" | "auto" | "required";
  stream?: boolean;
  user?: string;
}

export interface ChatCompletionResponse {
  text: string | null;
  tool_calls?: ToolCall[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  finish_reason: string;
}

export class OpenAIClient {
  private apiKey: string;
  private baseURL = "https://api.openai.com/v1";
  private defaultModel = "gpt-4o-mini";
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured");
    }
  }

  /**
   * Create chat completion
   */
  async createChatCompletion(
    request: ChatCompletionRequest,
    correlationId?: string,
  ): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(request, correlationId);
        const latencyMs = Date.now() - startTime;

        await logStructuredEvent("OPENAI_COMPLETION_SUCCESS", {
          correlation_id: correlationId,
          model: request.model || this.defaultModel,
          latency_ms: latencyMs,
          tokens: response.usage.total_tokens,
          cost_usd: response.cost_usd,
          attempt,
        });

        return response;
      } catch (error) {
        lastError = error as Error;

        await logStructuredEvent("OPENAI_COMPLETION_ERROR", {
          correlation_id: correlationId,
          error: getErrorMessage(error),
          attempt,
          will_retry: attempt < this.maxRetries,
        });

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error("OpenAI request failed after retries");
  }

  /**
   * Make HTTP request to OpenAI API
   */
  private async makeRequest(
    request: ChatCompletionRequest,
    correlationId?: string,
  ): Promise<ChatCompletionResponse> {
    const body: Record<string, any> = {
      model: request.model || this.defaultModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1000,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = request.tool_choice || "auto";
    }

    if (request.user) {
      body.user = request.user;
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        ...(correlationId && { "X-Correlation-ID": correlationId }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${
          error.error?.message || "Unknown error"
        }`,
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error("No response from OpenAI");
    }

    const message = choice.message;
    const tool_calls = message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    const cost_usd = this.calculateCost(
      data.usage?.prompt_tokens || 0,
      data.usage?.completion_tokens || 0,
      request.model || this.defaultModel,
    );

    return {
      text: message.content,
      tool_calls,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      },
      cost_usd,
      finish_reason: choice.finish_reason,
    };
  }

  /**
   * Calculate API cost based on model and token usage
   */
  private calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string,
  ): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      "gpt-4o": { prompt: 0.0025, completion: 0.01 },
      "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
      "gpt-4-turbo": { prompt: 0.01, completion: 0.03 },
      "gpt-3.5-turbo": { prompt: 0.0005, completion: 0.0015 },
    };

    const modelPricing = pricing[model] || pricing["gpt-4o-mini"];

    return (
      (promptTokens / 1000) * modelPricing.prompt +
      (completionTokens / 1000) * modelPricing.completion
    );
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(
    text: string,
    model: string = "text-embedding-3-small",
    correlationId?: string,
  ): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          ...(correlationId && { "X-Correlation-ID": correlationId }),
        },
        body: JSON.stringify({
          model,
          input: text,
          encoding_format: "float",
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI embeddings error: ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding as number[] | undefined;
      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        return embedding;
      }

      const fallback = new Array(1536).fill(0);
      await logStructuredEvent("OPENAI_EMBEDDING_FALLBACK", {
        correlation_id: correlationId,
        reason: "empty_response",
      });
      return fallback;
    } catch (error) {
      await logStructuredEvent("OPENAI_EMBEDDING_ERROR", {
        correlation_id: correlationId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let openaiClientInstance: OpenAIClient | null = null;

export function getOpenAIClient(): OpenAIClient {
  if (!openaiClientInstance) {
    openaiClientInstance = new OpenAIClient();
  }
  return openaiClientInstance;
}
