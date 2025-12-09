import { env } from "process";
import { logWarn, logError } from "@/lib/observability/logger";

interface StructuredJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  attachments?: Array<{ mimeType: string; base64Data: string }>;
  temperature?: number;
  maxOutputTokens?: number;
}

class OpenAiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAiConfigurationError";
  }
}

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

function getOpenAiApiKey() {
  const key = env.OPENAI_API_KEY;
  if (!key) {
    throw new OpenAiConfigurationError("OPENAI_API_KEY is not configured");
  }
  return key;
}

function extractStructuredJson<T>(payload: unknown): T {
  const candidate = payload as Record<string, unknown>;

  const output = (candidate?.output as unknown[]) ?? [];
  for (const item of output ?? []) {
    const content = (item as { content?: unknown[] })?.content ?? [];
    for (const block of content ?? []) {
      if (typeof block !== "object" || block === null) continue;
      const type = (block as { type?: string }).type;

      if (type === "output_json_schema") {
        const parsed = (block as { json_schema?: { parsed?: unknown } }).json_schema?.parsed;
        if (parsed) {
          return parsed as T;
        }
      }

      if (type === "json_schema") {
        const parsed = (block as { json_schema?: unknown }).json_schema;
        if (parsed) {
          return parsed as T;
        }
      }

      if (type === "output_text") {
        const text = (block as { text?: string }).text;
        if (text) {
          try {
            return JSON.parse(text) as T;
          } catch (error) {
            logWarn("Failed to parse output_text as JSON", error);
          }
        }
      }

      if (type === "text") {
        const text = (block as { text?: string }).text;
        if (text) {
          try {
            return JSON.parse(text) as T;
          } catch (error) {
            logWarn("Failed to parse text block as JSON", error);
          }
        }
      }
    }
  }

  const parsed =
    (candidate as { response?: { output_text?: string[] } }).response?.output_text ?? [];
  for (const entry of parsed) {
    if (typeof entry !== "string") continue;
    try {
      return JSON.parse(entry) as T;
    } catch (error) {
      logWarn("Failed to parse response.output_text entry as JSON", error);
    }
  }

  throw new Error("Unable to extract structured JSON from OpenAI response");
}

export async function requestStructuredJson<T>(options: StructuredJsonOptions): Promise<T> {
  const apiKey = getOpenAiApiKey();
  const model = env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini";

  const systemContent = options.systemPrompt
    ? [{ type: "input_text", text: options.systemPrompt }]
    : [];

  const userContent: Array<Record<string, unknown>> = [
    { type: "input_text", text: options.userPrompt },
  ];

  for (const attachment of options.attachments ?? []) {
    userContent.push({
      type: "input_file",
      mime_type: attachment.mimeType,
      data: attachment.base64Data,
    });
  }

  const body = {
    model,
    input: [
      ...(systemContent.length > 0 ? [{ role: "system", content: systemContent }] : []),
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: options.schemaName,
        schema: options.schema,
      },
    },
    temperature: options.temperature ?? 0,
    max_output_tokens: options.maxOutputTokens ?? 1200,
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logError("OpenAI request failed", response.status, errorText);
    throw new Error(`OpenAI error ${response.status}`);
  }

  const payload = await response.json();
  return extractStructuredJson<T>(payload);
}
