import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getOpenAIClient } from "@/lib/server/openai";

const RequestPayload = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  previousResponseId: z.string().min(1).optional(),
  reasoningEffort: z.enum(["minimal", "low", "medium", "high"]).default("low"),
  verbosity: z.enum(["low", "medium", "high"]).default("medium"),
  maxOutputTokens: z.number().int().positive().max(4000).optional(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

type RequestBody = z.infer<typeof RequestPayload>;

function extractAssistantMessage(response: unknown): string | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const record = response as Record<string, unknown>;

  if (typeof record["output_text"] === "string" && record["output_text"]) {
    return record["output_text"] as string;
  }

  const output = record["output"];
  if (!Array.isArray(output)) {
    return null;
  }

  const textChunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    if ((item as { type?: string }).type !== "message") continue;
    const message = item as { content?: Array<{ type?: string; text?: string }> };
    if (!Array.isArray(message.content)) continue;
    for (const content of message.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        textChunks.push(content.text);
      }
      if (content?.type === "text" && typeof content.text === "string") {
        textChunks.push(content.text);
      }
    }
  }

  if (textChunks.length === 0) {
    return null;
  }

  return textChunks.join("\n").trim();
}

function buildOpenAIRequest(body: RequestBody, requestId: string) {
  return {
    model: "gpt-5" as const,
    input: body.prompt,
    reasoning: { effort: body.reasoningEffort },
    text: { verbosity: body.verbosity },
    ...(body.previousResponseId ? { previous_response_id: body.previousResponseId } : {}),
    ...(body.maxOutputTokens ? { max_output_tokens: body.maxOutputTokens } : {}),
    metadata: {
      surface: "admin.gpt5_chat",
      request_id: requestId,
      ...(body.metadata ?? {}),
    },
  } satisfies Parameters<NonNullable<ReturnType<typeof getOpenAIClient>>["responses"]["create"]>[0];
}

export const POST = createHandler("api.gpt5-chat", async (request, _ctx, observability) => {
  const client = getOpenAIClient();
  if (!client) {
    observability.log({
      event: "api.gpt5-chat.misconfigured",
      status: "error",
      message: "OpenAI client unavailable (missing credentials)",
    });
    return jsonError({ error: "openai_not_configured", message: "OpenAI credentials are missing." }, 503);
  }

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch (error) {
    observability.log({
      event: "api.gpt5-chat.invalid_json",
      status: "error",
      message: error instanceof Error ? error.message : "Invalid JSON payload",
    });
    return jsonError({ error: "invalid_json", message: "Unable to parse request payload." }, 400);
  }

  const parsed = RequestPayload.safeParse(payloadRaw ?? {});
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  const body = parsed.data;
  const startedAt = Date.now();

  try {
    const response = await client.responses.create(buildOpenAIRequest(body, observability.requestId));
    const assistantMessage = extractAssistantMessage(response);

    if (!assistantMessage) {
      observability.log({
        event: "api.gpt5-chat.empty_response",
        status: "error",
        message: "GPT-5 response missing text output",
        details: { responseId: (response as { id?: string }).id },
      });
      return jsonError({ error: "empty_response", message: "GPT-5 response did not include text." }, 502);
    }

    const latencyMs = Date.now() - startedAt;

    observability.recordMetric("api.gpt5_chat.latency_ms", latencyMs, {
      reasoning_effort: body.reasoningEffort,
      verbosity: body.verbosity,
    });

    observability.log({
      event: "api.gpt5-chat.success",
      status: "ok",
      details: {
        responseId: (response as { id?: string }).id,
        latency_ms: latencyMs,
        reasoning_effort: body.reasoningEffort,
        verbosity: body.verbosity,
      },
    });

    return jsonOk({
      message: assistantMessage,
      previousResponseId: (response as { id?: string }).id ?? null,
      usage: (response as { usage?: unknown }).usage ?? null,
      latencyMs,
      fallbackModel: process.env.OPENAI_MODEL_FALLBACK?.trim() || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI failure";
    observability.log({
      event: "api.gpt5-chat.request_failed",
      status: "error",
      message,
      details: {
        reasoning_effort: body.reasoningEffort,
        verbosity: body.verbosity,
      },
    });

    const fallbackModel = process.env.OPENAI_MODEL_FALLBACK?.trim() || null;

    return jsonError(
      {
        error: "openai_request_failed",
        message,
        fallbackModel,
      },
      502,
    );
  }
});
