import { resolveOpenAiResponseText } from "../../../../lib/openai_responses.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ??
  "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ??
  "https://api.openai.com/v1";

const OCR_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2; // initial attempt + one retry on 5xx

const OCR_PROMPT =
  `You are extracting fields from a motor insurance certificate (photo or PDF).
Return a single JSON object. No prose. Fields:
{
  "insurer_name": string,
  "policy_number": string,
  "certificate_number": string,
  "policy_inception": "YYYY-MM-DD",
  "policy_expiry": "YYYY-MM-DD",
  "carte_jaune_number": string|null,
  "carte_jaune_expiry": "YYYY-MM-DD"|null,
  "make": string|null,
  "model": string|null,
  "vehicle_year": number|null,
  "registration_plate": string,
  "vin_chassis": string|null,
  "usage": string|null,
  "licensed_to_carry": number|null
}
If unknown, return null. Dates must be ISO (YYYY-MM-DD). Do not add fields.`;

const OCR_JSON_SCHEMA = {
  name: "motor_insurance_certificate",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      insurer_name: { type: "string" },
      policy_number: { type: "string" },
      certificate_number: { type: "string" },
      policy_inception: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      policy_expiry: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      carte_jaune_number: { type: ["string", "null"] },
      carte_jaune_expiry: {
        type: ["string", "null"],
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      make: { type: ["string", "null"] },
      model: { type: ["string", "null"] },
      vehicle_year: { type: ["integer", "null"] },
      registration_plate: { type: "string" },
      vin_chassis: { type: ["string", "null"] },
      usage: { type: ["string", "null"] },
      licensed_to_carry: { type: ["integer", "null"] },
    },
    required: [
      "insurer_name",
      "policy_number",
      "certificate_number",
      "policy_inception",
      "policy_expiry",
      "registration_plate",
    ],
  },
} as const;

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
    this.name = "MissingOpenAIKeyError";
  }
}

export async function runInsuranceOCR(
  signedUrl: string,
): Promise<Record<string, unknown>> {
  if (!OPENAI_API_KEY) {
    throw new MissingOpenAIKeyError();
  }

  const payload = {
    model: OPENAI_VISION_MODEL,
    input: [
      {
        role: "system",
        content: "You are an expert insurance document parser.",
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: OCR_PROMPT },
          {
            type: "input_image",
            image_url: { url: signedUrl },
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        json_schema: OCR_JSON_SCHEMA,
      },
    },
  } as const;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
    try {
      const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      clearTimeout(timeout);

      if (response.status >= 500 && response.status < 600) {
        lastError = new Error(`openai_${response.status}`);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`OpenAI request failed: ${response.status} ${text}`);
      }

      const json = await response.json();
      const helperContent = resolveOpenAiResponseText(json);
      if (helperContent && helperContent.trim().length) {
        return JSON.parse(helperContent);
      }
      const resolved =
        typeof json?.output_text === "string" && json.output_text.trim().length
          ? json.output_text
          : extractContentText(
            json?.output?.[0]?.content ?? json?.choices?.[0]?.message?.content,
          );
      if (!resolved) {
        throw new Error("OpenAI response missing content");
      }
      const parsed = JSON.parse(resolved);
      return parsed;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error("openai_timeout");
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error ?? "unknown_error"));
      }

      const isRetryable = attempt < MAX_RETRIES - 1 &&
        (lastError instanceof Error) &&
        /openai_5/.test(lastError.message);
      if (!isRetryable) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("OpenAI request failed");
}

function extractContentText(content: unknown): string | null {
  if (!content) return null;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object") {
        if (typeof part.text === "string") return part.text;
        if (typeof part.data === "string") return part.data;
      }
    }
  }
  if (
    typeof content === "object" &&
    "text" in (content as Record<string, unknown>)
  ) {
    const candidate = (content as { text?: unknown }).text;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}
