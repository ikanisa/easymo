// Provider clients
export { getOpenAIClient, resetOpenAIClient } from "./providers/openai-client";
export { getGeminiClient, resetGeminiClient, GEMINI_MODELS } from "./providers/gemini-client";

// Multi-provider router
export { routeChatRequest } from "./router";

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
