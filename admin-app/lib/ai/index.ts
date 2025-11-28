// Provider clients
export { getOpenAIClient, resetOpenAIClient } from "./providers/openai-client";
export { getGeminiClient, resetGeminiClient, GEMINI_MODELS } from "./providers/gemini-client";

// Multi-provider router
export { routeChatRequest } from "./router";

// Google AI integrations (Phase 2)
export * from "./google";

// Tools & Agent Execution (Phase 3)
export * from "./tools";
export * from "./agent-executor";

// Re-export existing chat completions types
export type {
  ChatCompletionRole,
  ChatCompletionMessage,
  ChatCompletionTool,
  ChatCompletionRequestOptions,
  ChatCompletionChoice,
  ChatCompletionUsage,
  ChatCompletionResponse,
  ChatCompletionErrorShape,
} from "./chat-completions";
