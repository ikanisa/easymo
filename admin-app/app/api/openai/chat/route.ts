import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  type ChatCompletionMessage,
  type ChatCompletionRequestOptions,
  type ChatCompletionResponse,
  type ChatCompletionErrorShape,
} from "@/lib/ai/chat-completions";

const DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_ORGANIZATION = process.env.OPENAI_ORGANIZATION?.trim();
const OPENAI_PROJECT = process.env.OPENAI_PROJECT?.trim();
const OPENAI_BETA_HEADER = process.env.OPENAI_BETA_HEADER?.trim();

const ALLOWED_ROLES = new Set<ChatCompletionMessage["role"]>([
  "system",
  "user",
  "assistant",
  "tool",
  "developer",
]);

function sanitizeMessages(messages: ChatCompletionMessage[]): ChatCompletionMessage[] {
  return messages
    .filter((message) => ALLOWED_ROLES.has(message.role) && typeof message.content === "string")
    .map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.name && typeof message.name === "string" ? { name: message.name } : {}),
    }));
}

function buildOpenAIRequestBody(
  payload: ChatCompletionRequestOptions,
  messages: ChatCompletionMessage[],
) {
  const body: Record<string, unknown> = {
    model: payload.model ?? DEFAULT_MODEL,
    messages,
  };

  if (typeof payload.temperature === "number") {
    body.temperature = payload.temperature;
  }
  if (typeof payload.topP === "number") {
    body.top_p = payload.topP;
  }
  if (typeof payload.presencePenalty === "number") {
    body.presence_penalty = payload.presencePenalty;
  }
  if (typeof payload.frequencyPenalty === "number") {
    body.frequency_penalty = payload.frequencyPenalty;
  }
  if (typeof payload.maxCompletionTokens === "number") {
    body.max_completion_tokens = payload.maxCompletionTokens;
  }
  if (typeof payload.reasoningEffort === "string") {
    body.reasoning_effort = payload.reasoningEffort;
  }
  if (payload.responseFormat) {
    body.response_format = payload.responseFormat;
  }
  if (payload.toolChoice) {
    body.tool_choice = payload.toolChoice;
  }
  if (payload.tools?.length) {
    body.tools = payload.tools;
  }
  if (payload.metadata) {
    body.metadata = payload.metadata;
  }
  if (typeof payload.parallelToolCalls === "boolean") {
    body.parallel_tool_calls = payload.parallelToolCalls;
  }
  if (typeof payload.store === "boolean") {
    body.store = payload.store;
  }
  if (payload.prediction !== undefined) {
    body.prediction = payload.prediction;
  }
  if (payload.stop) {
    body.stop = payload.stop;
  }
  if (payload.serviceTier) {
    body.service_tier = payload.serviceTier;
  }
  if (payload.verbosity) {
    body.verbosity = payload.verbosity;
  }

  return body;
}

function createErrorResponse(error: ChatCompletionErrorShape, status: number) {
  return NextResponse.json(error, { status });
}

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return createErrorResponse(
      {
        error: "openai_api_key_missing",
        status: 500,
        details: "OPENAI_API_KEY is not configured for the admin app runtime.",
      },
      500,
    );
  }

  let payload: ChatCompletionRequestOptions;
  try {
    payload = (await request.json()) as ChatCompletionRequestOptions;
  } catch (error) {
    return createErrorResponse(
      {
        error: "invalid_json_payload",
        status: 400,
        details: (error as Error)?.message ?? "Unable to parse request body.",
      },
      400,
    );
  }

  if (!payload || !Array.isArray(payload.messages)) {
    return createErrorResponse(
      {
        error: "invalid_messages",
        status: 400,
        details: "`messages` must be an array of chat messages.",
      },
      400,
    );
  }

  const sanitizedMessages = sanitizeMessages(payload.messages);
  if (sanitizedMessages.length === 0) {
    return createErrorResponse(
      {
        error: "no_valid_messages",
        status: 400,
        details: "Provide at least one message with a supported role and string content.",
      },
      400,
    );
  }

  const requestBody = buildOpenAIRequestBody(payload, sanitizedMessages);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };

  if (OPENAI_ORGANIZATION) {
    headers["OpenAI-Organization"] = OPENAI_ORGANIZATION;
  }
  if (OPENAI_PROJECT) {
    headers["OpenAI-Project"] = OPENAI_PROJECT;
  }
  if (OPENAI_BETA_HEADER) {
    headers["OpenAI-Beta"] = OPENAI_BETA_HEADER;
  }

  const startedAt = Date.now();
  let openaiResponse: Response;
  try {
    openaiResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error("admin.openai_chat.fetch_failed", error);
    return createErrorResponse(
      {
        error: "openai_request_failed",
        status: 502,
        details: (error as Error)?.message ?? "Unable to reach OpenAI APIs.",
      },
      502,
    );
  }

  let responseBody: unknown = null;
  try {
    responseBody = await openaiResponse.json();
  } catch (error) {
    console.error("admin.openai_chat.parse_failed", error);
    return createErrorResponse(
      {
        error: "openai_response_parse_failed",
        status: 502,
        details: (error as Error)?.message ?? "Received a non-JSON response from OpenAI.",
      },
      502,
    );
  }

  if (!openaiResponse.ok) {
    console.error("admin.openai_chat.upstream_error", responseBody);
    return createErrorResponse(
      {
        error: "openai_error_response",
        status: openaiResponse.status,
        details: responseBody,
      },
      openaiResponse.status,
    );
  }

  const completion = responseBody as ChatCompletionResponse;
  const latency = Date.now() - startedAt;
  const requestId = openaiResponse.headers.get("x-request-id");

  return NextResponse.json({
    completion,
    request: {
      model: requestBody.model,
      temperature: (requestBody as { temperature?: number }).temperature ?? null,
      maxCompletionTokens: (requestBody as { max_completion_tokens?: number }).max_completion_tokens ?? null,
      messageCount: sanitizedMessages.length,
    },
    metadata: {
      latencyMs: latency,
      requestId,
      serviceTier: completion.service_tier ?? null,
      systemFingerprint: completion.system_fingerprint ?? null,
    },
  });
}

export const runtime = "edge";
