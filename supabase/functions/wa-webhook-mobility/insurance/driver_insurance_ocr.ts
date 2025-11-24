/**
 * Driver Insurance OCR Module
 * 
 * Processes driver insurance certificates using OCR (OpenAI Vision + Gemini fallback)
 * Validates insurance data and checks for duplicate vehicles
 */

import type { SupabaseClient } from "../deps.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const OCR_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

const DRIVER_OCR_PROMPT = `You are extracting fields from a motor insurance certificate (photo or PDF) for driver onboarding.
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
If unknown, return null. Dates must be ISO (YYYY-MM-DD). registration_plate is REQUIRED.`;

const DRIVER_OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    insurer_name: { type: "string" },
    policy_number: { type: "string" },
    certificate_number: { type: "string" },
    policy_inception: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    policy_expiry: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    carte_jaune_number: { type: ["string", "null"] },
    carte_jaune_expiry: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
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
} as const;

export interface DriverInsuranceData {
  insurer_name: string;
  policy_number: string;
  certificate_number: string;
  policy_inception: string;
  policy_expiry: string;
  carte_jaune_number: string | null;
  carte_jaune_expiry: string | null;
  make: string | null;
  model: string | null;
  vehicle_year: number | null;
  registration_plate: string;
  vin_chassis: string | null;
  usage: string | null;
  licensed_to_carry: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Process insurance certificate using Gemini Vision API
 */
async function runGeminiOCR(signedUrl: string): Promise<DriverInsuranceData> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  console.info("DRIVER_INS_OCR_GEMINI_START");

  const imgResp = await fetch(signedUrl);
  if (!imgResp.ok) throw new Error("Failed to fetch image for Gemini");
  
  const blob = await imgResp.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const mimeType = blob.type || "image/jpeg";

  const payload = {
    contents: [{
      parts: [
        { text: DRIVER_OCR_PROMPT },
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
      response_schema: DRIVER_OCR_SCHEMA,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  console.info("DRIVER_INS_OCR_GEMINI_OK");
  return JSON.parse(content);
}

/**
 * Process insurance certificate using OpenAI Vision API
 */
async function runOpenAIOCR(signedUrl: string): Promise<DriverInsuranceData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const payload = {
    model: OPENAI_VISION_MODEL,
    messages: [
      {
        role: "system",
        content: "You are an expert insurance document parser for driver onboarding.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: DRIVER_OCR_PROMPT },
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
        name: "driver_insurance_certificate",
        schema: DRIVER_OCR_SCHEMA,
      },
    },
  } as const;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
    
    try {
      console.info("DRIVER_INS_OCR_OPENAI_CALL", {
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
        console.warn("DRIVER_INS_OCR_RETRYABLE", { status: response.status });
        lastError = new Error(`openai_${response.status}`);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`OpenAI request failed: ${response.status} ${text}`);
      }

      const json = await response.json();
      const messageContent = json?.choices?.[0]?.message?.content;

      if (!messageContent || typeof messageContent !== "string") {
        throw new Error("OpenAI response missing message content");
      }

      console.info("DRIVER_INS_OCR_OPENAI_OK");
      return JSON.parse(messageContent);
    } catch (error) {
      clearTimeout(timeout);
      
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error("openai_timeout");
      } else {
        lastError = error;
      }

      const isRetryable = attempt < MAX_RETRIES - 1 &&
        lastError instanceof Error &&
        /openai_5/.test(lastError.message);
      
      if (!isRetryable) {
        console.error("DRIVER_INS_OCR_OPENAI_ERROR", { error: lastError });
        throw lastError;
      }
    }
  }

  throw lastError || new Error("OpenAI OCR failed after retries");
}

/**
 * Process driver insurance certificate with OCR
 * Uses OpenAI Vision API with Gemini fallback
 */
export async function processDriverInsuranceCertificate(
  signedUrl: string,
  mimeType?: string,
): Promise<{ data: DriverInsuranceData; provider: "openai" | "gemini" }> {
  // Try OpenAI first
  try {
    const data = await runOpenAIOCR(signedUrl);
    return { data, provider: "openai" };
  } catch (openaiError) {
    console.warn("DRIVER_INS_OCR_OPENAI_FAILED", openaiError);
  }

  // Fallback to Gemini
  try {
    const data = await runGeminiOCR(signedUrl);
    return { data, provider: "gemini" };
  } catch (geminiError) {
    console.error("DRIVER_INS_OCR_GEMINI_FAILED", geminiError);
    throw new Error("Failed to process insurance certificate with both OpenAI and Gemini");
  }
}

/**
 * Validate extracted insurance data
 */
export function validateInsuranceData(data: DriverInsuranceData): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!data.insurer_name?.trim()) {
    errors.push("insurer_name");
  }
  if (!data.policy_number?.trim()) {
    errors.push("policy_number");
  }
  if (!data.registration_plate?.trim()) {
    errors.push("registration_plate");
  }

  // Validate dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const expiryDate = new Date(data.policy_expiry);
    if (isNaN(expiryDate.getTime())) {
      errors.push("policy_expiry (invalid date)");
    } else if (expiryDate < today) {
      errors.push("policy_expiry (expired)");
    }
  } catch {
    errors.push("policy_expiry (parse error)");
  }

  try {
    const inceptionDate = new Date(data.policy_inception);
    if (isNaN(inceptionDate.getTime())) {
      errors.push("policy_inception (invalid date)");
    }
  } catch {
    errors.push("policy_inception (parse error)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if vehicle plate is already registered by another user
 */
export async function checkDuplicateVehicle(
  supabase: SupabaseClient,
  plate: string,
  excludeUserId?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_duplicate_vehicle_plate", {
    p_plate: plate,
    p_exclude_user_id: excludeUserId || null,
  });

  if (error) {
    console.error("DRIVER_INS_DUPLICATE_CHECK_ERROR", error);
    throw error;
  }

  return data === true;
}

/**
 * Save insurance certificate to database
 */
export async function saveInsuranceCertificate(
  supabase: SupabaseClient,
  userId: string,
  data: DriverInsuranceData,
  mediaUrl: string,
  mediaId: string | null,
  provider: "openai" | "gemini",
  rawOcrData: Record<string, unknown>,
): Promise<{ id: string; error?: string }> {
  const { data: inserted, error } = await supabase
    .from("driver_insurance_certificates")
    .insert({
      user_id: userId,
      insurer_name: data.insurer_name,
      policy_number: data.policy_number,
      certificate_number: data.certificate_number,
      policy_inception: data.policy_inception,
      policy_expiry: data.policy_expiry,
      carte_jaune_number: data.carte_jaune_number,
      carte_jaune_expiry: data.carte_jaune_expiry,
      vehicle_plate: data.registration_plate.toUpperCase(),
      make: data.make,
      model: data.model,
      vehicle_year: data.vehicle_year,
      vin_chassis: data.vin_chassis,
      usage: data.usage,
      licensed_to_carry: data.licensed_to_carry,
      certificate_media_url: mediaUrl,
      certificate_media_id: mediaId,
      ocr_provider: provider,
      raw_ocr_data: rawOcrData,
      status: "approved", // Auto-approve if validation passed
      is_validated: true,
      validated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("DRIVER_INS_SAVE_ERROR", error);
    return { id: "", error: error.message };
  }

  // Update profile with vehicle plate
  await supabase
    .from("profiles")
    .update({ vehicle_plate: data.registration_plate.toUpperCase() })
    .eq("user_id", userId);

  return { id: inserted.id };
}
