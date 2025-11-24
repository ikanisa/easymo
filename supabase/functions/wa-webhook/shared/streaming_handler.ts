/**
 * Streaming Response Handler for OpenAI
 * 
 * Handles server-sent events (SSE) from OpenAI Chat Completions API
 * Accumulates chunks and provides real-time updates
 * 
 * ADDITIVE ONLY - New file, no modifications to existing code
 */

import { logStructuredEvent } from "../observe/log.ts";
import type { ChatMessage, Tool, ToolCall } from "./openai_client.ts";

interface StreamChunk {
  delta: string | null;
  toolCall?: Partial<ToolCall>;
  usage?: TokenUsage;
  done: boolean;
  finishReason?: string;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamingRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  toolChoice?: "none" | "auto" | "required";
  user?: string;
  apiKey: string;
  correlationId?: string;
}

export class StreamingHandler {
  private baseURL = "https://api.openai.com/v1";

  /**
   * Stream chat completion responses
   * Yields chunks as they arrive from OpenAI
   */
  async *stream(request: StreamingRequest): AsyncGenerator<StreamChunk> {
    const startTime = Date.now();
    let fullContent = "";
    const toolCallsInProgress = new Map<number, Partial<ToolCall>>();

    try {
      const body: Record<string, any> = {
        model: request.model || "gpt-4o-mini",
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1000,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      };

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools;
        body.tool_choice = request.toolChoice || "auto";
      }

      if (request.user) {
        body.user = request.user;
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${request.apiKey}`,
          ...(request.correlationId && {
            "X-Correlation-ID": request.correlationId,
          }),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI streaming error: ${response.status} - ${
            error.error?.message || "Unknown error"
          }`,
        );
      }

      if (!response.body) {
        throw new Error("No response body for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.trim() === "data: [DONE]") continue;

          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              const choice = json.choices?.[0];

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
                      type: "function",
                      function: {
                        name: toolCallDelta.function?.name || "",
                        arguments: "",
                      },
                    });
                  }

                  const toolCall = toolCallsInProgress.get(index)!;

                  if (toolCallDelta.function?.name) {
                    toolCall.function!.name = toolCallDelta.function.name;
                  }

                  if (toolCallDelta.function?.arguments) {
                    toolCall.function!.arguments +=
                      toolCallDelta.function.arguments;
                  }

                  yield {
                    delta: null,
                    toolCall,
                    done: false,
                  };
                }
              }

              // Handle usage (final chunk)
              if (json.usage) {
                const latencyMs = Date.now() - startTime;

                await logStructuredEvent("OPENAI_STREAMING_COMPLETE", {
                  correlation_id: request.correlationId,
                  model: request.model || "gpt-4o-mini",
                  latency_ms: latencyMs,
                  tokens: json.usage.total_tokens,
                  content_length: fullContent.length,
                  tool_calls_count: toolCallsInProgress.size,
                });

                yield {
                  delta: null,
                  usage: {
                    promptTokens: json.usage.prompt_tokens,
                    completionTokens: json.usage.completion_tokens,
                    totalTokens: json.usage.total_tokens,
                  },
                  done: true,
                  finishReason: choice.finish_reason,
                };
              }
            } catch (error) {
              console.error("Error parsing streaming chunk:", error);
            }
          }
        }
      }
    } catch (error) {
      await logStructuredEvent("OPENAI_STREAMING_ERROR", {
        correlation_id: request.correlationId,
        error: error instanceof Error ? error.message : String(error),
        elapsed_ms: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Accumulate full response from stream
   * Useful when you want streaming internally but need the complete response
   */
  async accumulateStream(
    request: StreamingRequest,
  ): Promise<{
    content: string;
    toolCalls: ToolCall[];
    usage: TokenUsage;
    finishReason: string;
  }> {
    let content = "";
    const toolCalls: ToolCall[] = [];
    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let finishReason = "";

    const stream = this.stream(request);

    for await (const chunk of stream) {
      if (chunk.delta) {
        content += chunk.delta;
      }

      if (chunk.toolCall && chunk.toolCall.id) {
        const existingIndex = toolCalls.findIndex((tc) =>
          tc.id === chunk.toolCall!.id
        );
        if (existingIndex >= 0) {
          toolCalls[existingIndex] = chunk.toolCall as ToolCall;
        } else {
          toolCalls.push(chunk.toolCall as ToolCall);
        }
      }

      if (chunk.usage) {
        usage = chunk.usage;
      }

      if (chunk.finishReason) {
        finishReason = chunk.finishReason;
      }
    }

    return { content, toolCalls, usage, finishReason };
  }
}

/**
 * Singleton instance
 */
let streamingHandlerInstance: StreamingHandler | null = null;

export function getStreamingHandler(): StreamingHandler {
  if (!streamingHandlerInstance) {
    streamingHandlerInstance = new StreamingHandler();
  }
  return streamingHandlerInstance;
}
