export type ChatCompletionRole =
  | "system"
  | "user"
  | "assistant"
  | "tool"
  | "developer";

export interface ChatCompletionMessage {
  role: ChatCompletionRole;
  content: string;
  name?: string;
}

export interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ChatCompletionRequestOptions {
  /**
   * Defaults to gpt-4o-mini to balance latency and cost for the admin playground.
   */
  model?: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  maxCompletionTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  responseFormat?: Record<string, unknown>;
  toolChoice?: "none" | "auto" | { type: "function"; function: { name: string } };
  tools?: ChatCompletionTool[];
  metadata?: Record<string, string>;
  parallelToolCalls?: boolean;
  store?: boolean;
  prediction?: Record<string, unknown> | null;
  stop?: string | string[];
  serviceTier?: "auto" | "default" | "flex" | "priority";
  verbosity?: "low" | "medium" | "high";
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: ChatCompletionRole;
    content: string | null;
  };
  finish_reason: string | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: Record<string, unknown>;
  completion_tokens_details?: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  id: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
  system_fingerprint?: string;
  service_tier?: string;
}

export interface ChatCompletionErrorShape {
  error: string;
  status: number;
  details?: unknown;
}
