import { GEMINI_API_KEY } from "../../config.ts";
import { supabase as sharedSupabase } from "../../config.ts";
import { openaiCircuitBreaker, geminiCircuitBreaker } from "./circuit_breaker.ts";
import * as ImageScript from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ??
  "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ??
  "https://api.openai.com/v1";

const DEFAULT_OCR_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

const MAX_IMAGE_LONGEST_EDGE = 1024; // pixels

// Dynamic config cache (refresh every 5 minutes)
let configCache: { timeout: number; retries: number; fetchedAt: number } | null = null;
const CONFIG_TTL_MS = 5 * 60 * 1000;

async function getOCRConfig(): Promise<{ timeout: number; retries: number }> {
  const now = Date.now();
  if (configCache && (now - configCache.fetchedAt) < CONFIG_TTL_MS) {
    return { timeout: configCache.timeout, retries: configCache.retries };
  }

  try {
    const { data } = await sharedSupabase
      .from('app_config')
      .select('insurance_ocr_timeout_ms, insurance_ocr_max_retries')
      .eq('id', 1)
      .single();

    const timeout = typeof data?.insurance_ocr_timeout_ms === 'number' 
      ? data.insurance_ocr_timeout_ms 
      : DEFAULT_OCR_TIMEOUT_MS;
    const retries = typeof data?.insurance_ocr_max_retries === 'number' 
      ? data.insurance_ocr_max_retries 
      : DEFAULT_MAX_RETRIES;

    configCache = { timeout, retries, fetchedAt: now };
    return { timeout, retries };
  } catch (err) {
    console.warn("insurance.ocr.config_fetch_fail", err);
    return { timeout: DEFAULT_OCR_TIMEOUT_MS, retries: DEFAULT_MAX_RETRIES };
  }
}

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

async function runGeminiOCR(signedUrl: string, originalMimeType?: string): Promise<Record<string, unknown>> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (isCircuitOpen("gemini")) {
    throw new Error(
      "Gemini circuit breaker is open - service temporarily unavailable",
    );
  }

  return await geminiCircuitBreaker.execute(async () => {
    console.info("INS_OCR_FALLBACK_GEMINI_START");

    try {
      const { base64, mimeType } = await fetchAndResizeImage(signedUrl, originalMimeType);

      const payload = {
        contents: [{
          parts: [
            { text: OCR_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64,
              },
            },
          ],
        }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: OCR_JSON_SCHEMA,
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
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
      recordSuccess("gemini");
      return JSON.parse(content);
    } catch (error) {
      recordFailure("gemini");
      throw error;
    }
  });
}

export async function runInsuranceOCR(
  signedUrl: string,
  mimeType?: string,
): Promise<Record<string, unknown>> {
  const config = await getOCRConfig();

  const lowerMime = (mimeType || "").toLowerCase();
  const isPdf = lowerMime.includes("pdf") || /\.pdf(\?|$)/i.test(signedUrl);
  if (isPdf) {
    try {
      return await runGeminiOCR(signedUrl, mimeType); // Pass mimeType
    } catch (geminiError) {
      console.error("INS_OCR_PDF_GEMINI_FAIL", geminiError);
    }
  }

  const openAICircuitOpen = isCircuitOpen("openai");

  if (!openAICircuitOpen) {
    try {
      if (!OPENAI_API_KEY) {
        console.warn("INS_OCR_OPENAI_KEY_MISSING", { fallback: "gemini" });
        throw new MissingOpenAIKeyError();
      }

      const { base64, mimeType: processedMimeType } = await fetchAndResizeImage(signedUrl, mimeType); // Fetch and resize

      const result = await openaiCircuitBreaker.execute(async () => {
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
                  image_url: { url: `data:${processedMimeType};base64,${base64}` }, // Use base64 data
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

        for (let attempt = 0; attempt < config.retries; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), config.timeout);

          try {
            console.info("INS_OCR_CALL", {
              model: OPENAI_VISION_MODEL,
              attempt: attempt + 1,
              timeout: config.timeout,
              maxRetries: config.retries,
              circuitState: openaiCircuitBreaker.getState(),
            });

            const response = await fetch(
              `${OPENAI_BASE_URL}/chat/completions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
                signal: controller.signal,
                body: JSON.stringify(payload),
              },
            );

            if (response.status >= 500 && response.status < 600) {
              console.warn("INS_OCR_RETRYABLE_STATUS", {
                status: response.status,
              });
              lastError = new Error("openai_500");
              continue;
            }

            if (!response.ok) {
              const text = await response.text().catch(() => "");
              console.error("INS_OCR_BAD_STATUS", {
                status: response.status,
                text: text?.slice(0, 200),
              });
              throw new Error(
                `OpenAI request failed: ${response.status} ${text}`,
              );
            }

            const json = await response.json();
            const messageContent = json?.choices?.[0]?.message?.content;

            if (!messageContent || typeof messageContent !== "string") {
              console.error("INS_OCR_NO_CONTENT", {
                response: JSON.stringify(json).slice(0, 200),
              });
              throw new Error("OpenAI response missing message content");
            }

            console.info("INS_OCR_RESOLVED_OK", {
              preview: messageContent.slice(0, 120),
            });

            const parsed = JSON.parse(messageContent);
            recordSuccess("openai");
            return parsed;
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              lastError = new Error("openai_timeout");
            } else if (error instanceof Error) {
              lastError = error;
            } else {
              lastError = new Error(String(error ?? "unknown_error"));
            }

            const isRetryable = attempt < config.retries - 1 &&
              lastError instanceof Error &&
              /openai_5/.test(lastError.message);
            if (!isRetryable) {
              recordFailure("openai");
              throw lastError ??
                new Error("OpenAI OCR attempt failed without error detail");
            }

            console.warn("INS_OCR_OPENAI_RETRY", {
              attempt: attempt + 1,
              error: lastError instanceof Error ? lastError.message : String(lastError),
            });
          } finally {
            clearTimeout(timeoutId);
          }
        }

        recordFailure("openai");
        throw lastError ?? new Error("OpenAI OCR failed after retries");
      });

      return result;
    } catch (e) {
      console.warn("INS_OCR_OPENAI_FAILED", {
        error: e instanceof Error ? e.message : String(e),
        circuitState: openaiCircuitBreaker.getState(),
      });
    }
  } else {
    console.info("INS_OCR_OPENAI_CIRCUIT_OPEN", { skipping: true });
  }

  try {
    return await runGeminiOCR(signedUrl, mimeType); // Pass mimeType
  } catch (geminiError) {
    console.error("INS_OCR_GEMINI_FAILED", {
      error: geminiError instanceof Error
        ? geminiError.message
        : String(geminiError),
      circuitState: geminiCircuitBreaker.getState(),
    });
    throw geminiError;
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
