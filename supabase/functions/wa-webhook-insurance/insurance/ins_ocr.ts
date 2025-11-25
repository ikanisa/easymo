import { resolveOpenAiResponseText } from "../../_shared/wa-webhook-shared/utils/openai_responses.ts";
import { GEMINI_API_KEY } from "../../_shared/wa-webhook-shared/config.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ??
  "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ??
  "https://api.openai.com/v1";

const OCR_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2; // initial attempt + one retry on 5xx

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // Number of failures before opening circuit
const CIRCUIT_BREAKER_RESET_MS = 60_000; // Time to wait before trying again (60 seconds)

// Circuit breaker state (module-level for persistence across calls within same instance)
type CircuitState = {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
};

const circuitState: { openai: CircuitState; gemini: CircuitState } = {
  openai: { failures: 0, lastFailure: 0, isOpen: false },
  gemini: { failures: 0, lastFailure: 0, isOpen: false },
};

function isCircuitOpen(service: 'openai' | 'gemini'): boolean {
  const state = circuitState[service];
  if (!state.isOpen) return false;
  
  // Check if enough time has passed to try again
  if (Date.now() - state.lastFailure >= CIRCUIT_BREAKER_RESET_MS) {
    console.info(`INS_OCR_CIRCUIT_HALF_OPEN`, { service });
    return false; // Allow a test request
  }
  return true;
}

function recordSuccess(service: 'openai' | 'gemini'): void {
  const state = circuitState[service];
  state.failures = 0;
  state.isOpen = false;
}

function recordFailure(service: 'openai' | 'gemini'): void {
  const state = circuitState[service];
  state.failures++;
  state.lastFailure = Date.now();
  
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
    console.warn(`INS_OCR_CIRCUIT_OPEN`, { service, failures: state.failures });
  }
}

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

const OCR_SCHEMA_NAME = "motor_insurance_certificate";

const OCR_JSON_SCHEMA = {
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
    "carte_jaune_number",
    "carte_jaune_expiry",
    "make",
    "model",
    "vehicle_year",
    "registration_plate",
    "vin_chassis",
    "usage",
    "licensed_to_carry",
  ],
} as const;

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
    this.name = "MissingOpenAIKeyError";
  }
}

async function runGeminiOCR(signedUrl: string): Promise<Record<string, unknown>> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Check circuit breaker
  if (isCircuitOpen('gemini')) {
    throw new Error("Gemini circuit breaker is open - service temporarily unavailable");
  }

  console.info("INS_OCR_FALLBACK_GEMINI_START");

  try {
    // Fetch image data
    const imgResp = await fetch(signedUrl);
    if (!imgResp.ok) throw new Error("Failed to fetch image for Gemini");
    const blob = await imgResp.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = blob.type || "image/jpeg";

    const payload = {
      contents: [{
        parts: [
          { text: OCR_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: OCR_JSON_SCHEMA
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${text}`);
    }

    const json = await response.json();
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error("Gemini response missing content");
    }

    console.info("INS_OCR_GEMINI_OK");
    recordSuccess('gemini');
    return JSON.parse(content);
  } catch (error) {
    recordFailure('gemini');
    throw error;
  }
}

export async function runInsuranceOCR(
  signedUrl: string,
  mimeType?: string,
): Promise<Record<string, unknown>> {
  // If PDF, prefer Gemini directly for better reliability
  const lowerMime = (mimeType || '').toLowerCase();
  const isPdf = lowerMime.includes('pdf') || /\.pdf(\?|$)/i.test(signedUrl);
  if (isPdf) {
    try {
      return await runGeminiOCR(signedUrl);
    } catch (geminiError) {
      console.error('INS_OCR_PDF_GEMINI_FAIL', geminiError);
      // fall through to OpenAI attempt (may fail for pdf)
    }
  }
  
  // Check OpenAI circuit breaker
  const openAICircuitOpen = isCircuitOpen('openai');
  
  // Try OpenAI first (unless circuit is open)
  if (!openAICircuitOpen) {
    try {
      if (!OPENAI_API_KEY) {
        console.warn("INS_OCR_OPENAI_KEY_MISSING", { fallback: "gemini" });
        throw new MissingOpenAIKeyError();
      }

      const payload = {
        model: OPENAI_VISION_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert insurance document parser.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              {
                type: "image_url",
                image_url: { url: signedUrl },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: OCR_SCHEMA_NAME,
            schema: OCR_JSON_SCHEMA,
          },
        },
      } as const;

      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
        try {
          console.info("INS_OCR_CALL", {
            model: OPENAI_VISION_MODEL,
            attempt: attempt + 1,
          });
          const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
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
            console.warn("INS_OCR_RETRYABLE_STATUS", { status: response.status });
            lastError = new Error(`openai_${response.status}`);
            // Don't record failure during retries - only record once after all retries exhausted
            continue;
          }

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            console.error("INS_OCR_BAD_STATUS", {
              status: response.status,
              text: text?.slice(0, 200),
            });
            // Non-retryable error - will be caught and failure recorded in catch block
            throw new Error(`OpenAI request failed: ${response.status} ${text}`);
          }

          const json = await response.json();
          
          // Extract content from OpenAI chat completion response
          const messageContent = json?.choices?.[0]?.message?.content;
          
          if (!messageContent || typeof messageContent !== 'string') {
            console.error("INS_OCR_NO_CONTENT", { response: JSON.stringify(json).slice(0, 200) });
            throw new Error("OpenAI response missing message content");
          }
          
          console.info("INS_OCR_RESOLVED_OK", { preview: messageContent.slice(0, 120) });
          
          // Parse the JSON response
          const parsed = JSON.parse(messageContent);
          recordSuccess('openai');
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
            // Record failure once after all retries are exhausted (covers all error cases)
            recordFailure('openai');
            console.error("INS_OCR_ERROR", {
              error: lastError instanceof Error
                ? lastError.message
                : String(lastError),
            });
            // Don't throw yet, break to fallback
            break;
          }
        }
      }
    } catch (e) {
      console.warn("INS_OCR_OPENAI_FAILED", e);
    }
  } else {
    console.info("INS_OCR_OPENAI_CIRCUIT_OPEN", { skipping: true });
  }

  // Fallback to Gemini
  try {
    return await runGeminiOCR(signedUrl);
  } catch (geminiError) {
    console.error("INS_OCR_GEMINI_FAILED", geminiError);
    throw geminiError; // Throw the final error if both fail
  }
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
