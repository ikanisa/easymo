import { RESPONSES_MODEL, responsesClient, VOUCHER_AGENT_SYSTEM_PROMPT } from "./client";
import { toolDefinitions } from "../schemas";
import { callTool } from "../tooling/callTool";
import type OpenAI from "openai";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ResponsesRouterOptions = {
  maxToolCalls?: number;
  temperature?: number;
  metadata?: Record<string, any>;
};

/**
 * Router for OpenAI Responses API with tool calling support
 * Handles multi-turn conversations with automatic tool execution
 */
export async function respond(
  input: Message[],
  options: ResponsesRouterOptions = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const { maxToolCalls = 5, temperature = 0.7, metadata = {} } = options;

  // Ensure system prompt is included
  const messages = input.some((m) => m.role === "system")
    ? input
    : [{ role: "system" as const, content: VOUCHER_AGENT_SYSTEM_PROMPT }, ...input];

  let currentMessages = messages;
  let toolCallCount = 0;

  while (toolCallCount < maxToolCalls) {
    const response = await responsesClient.chat.completions.create({
      model: RESPONSES_MODEL,
      messages: currentMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: toolDefinitions,
      temperature,
      // Add metadata for observability
      user: metadata.user_id,
    });

    const choice = response.choices[0];
    
    // No tool calls, return final response
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      return response;
    }

    // Process tool calls
    const toolCalls = choice.message.tool_calls;
    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || "{}");

        // Log tool execution for observability
        console.log("ai.tool.call", {
          correlation_id: metadata.correlation_id,
          tool_name: toolName,
          args_keys: Object.keys(args),
        });

        const result = await callTool(toolName, args, metadata);

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        console.error("ai.tool.error", {
          correlation_id: metadata.correlation_id,
          tool_call_id: toolCall.id,
          error: errorMessage,
        });

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: errorMessage,
          }),
        });
      }
    }

    // Add assistant message with tool calls and tool results to history
    currentMessages = [
      ...currentMessages,
      choice.message as any,
      ...toolResults,
    ] as any;

    toolCallCount++;
  }

  // If we hit max tool calls, return final response
  const finalResponse = await responsesClient.chat.completions.create({
    model: RESPONSES_MODEL,
    messages: currentMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature,
    user: metadata.user_id,
  });

  return finalResponse;
}

/**
 * Extract text content from a completion response
 */
export function extractTextContent(
  response: OpenAI.Chat.Completions.ChatCompletion
): string {
  return response.choices[0]?.message?.content || "";
}
