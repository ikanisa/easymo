/**
 * Driver License OCR Module
 * 
 * Processes driver's licenses using OCR (OpenAI Vision + Gemini fallback)
 * Validates license data including expiry dates
 */

import type { SupabaseClient } from "../deps.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const OCR_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

const LICENSE_OCR_PROMPT = `You are extracting fields from a driver's license (photo or PDF) for driver onboarding.
Return a single JSON object. No prose. Fields:
{
  "license_number": string,
  "full_name": string,
  "date_of_birth": "YYYY-MM-DD",
  "issue_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "license_class": string,
  "nationality": string|null,
  "address": string|null,
  "gender": "M"|"F"|null,
  "blood_group": string|null
}
If unknown, return null. Dates must be ISO (YYYY-MM-DD). license_number, full_name, and expiry_date are REQUIRED.`;

const LICENSE_OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    license_number: { type: "string" },
    full_name: { type: "string" },
    date_of_birth: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    issue_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    expiry_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    license_class: { type: "string" },
    nationality: { type: ["string", "null"] },
    address: { type: ["string", "null"] },
    gender: { type: ["string", "null"], enum: ["M", "F", null] },
    blood_group: { type: ["string", "null"] },
  },
  required: [
    "license_number",
    "full_name",
    "expiry_date",
    "license_class",
  ],
} as const;

export interface DriverLicenseData {
  license_number: string;
  full_name: string;
  date_of_birth: string | null;
  issue_date: string | null;
  expiry_date: string;
  license_class: string;
  nationality: string | null;
  address: string | null;
  gender: "M" | "F" | null;
  blood_group: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Process license using Gemini Vision API
 */
async function runGeminiOCR(signedUrl: string): Promise<DriverLicenseData> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  console.info("DRIVER_LICENSE_OCR_GEMINI_START");

  const imgResp = await fetch(signedUrl);
  if (!imgResp.ok) throw new Error("Failed to fetch image for Gemini");
  
  const blob = await imgResp.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const mimeType = blob.type || "image/jpeg";

  const payload = {
    contents: [{
      parts: [
        { text: LICENSE_OCR_PROMPT },
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
      response_schema: LICENSE_OCR_SCHEMA,
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

  console.info("DRIVER_LICENSE_OCR_GEMINI_OK");
  return JSON.parse(content);
}

/**
 * Process license using OpenAI Vision API
 */
async function runOpenAIOCR(signedUrl: string): Promise<DriverLicenseData> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const payload = {
    model: OPENAI_VISION_MODEL,
    messages: [
      {
        role: "system",
        content: "You are an expert driver's license document parser for driver onboarding.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: LICENSE_OCR_PROMPT },
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
        name: "driver_license",
        schema: LICENSE_OCR_SCHEMA,
      },
    },
  } as const;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
    
    try {
      console.info("DRIVER_LICENSE_OCR_OPENAI_CALL", {
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
        console.warn("DRIVER_LICENSE_OCR_RETRYABLE", { status: response.status });
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

      console.info("DRIVER_LICENSE_OCR_OPENAI_OK");
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
        console.error("DRIVER_LICENSE_OCR_OPENAI_ERROR", { error: lastError });
        throw lastError;
      }
    }
  }

  throw lastError || new Error("OpenAI OCR failed after retries");
}

/**
 * Process driver license with OCR
 * Uses OpenAI Vision API with Gemini fallback
 */
export async function processDriverLicense(
  signedUrl: string,
  mimeType?: string,
): Promise<{ data: DriverLicenseData; provider: "openai" | "gemini" }> {
  // Try OpenAI first
  try {
    const data = await runOpenAIOCR(signedUrl);
    return { data, provider: "openai" };
  } catch (openaiError) {
    console.warn("DRIVER_LICENSE_OCR_OPENAI_FAILED", openaiError);
  }

  // Fallback to Gemini
  try {
    const data = await runGeminiOCR(signedUrl);
    return { data, provider: "gemini" };
  } catch (geminiError) {
    console.error("DRIVER_LICENSE_OCR_GEMINI_FAILED", geminiError);
    throw new Error("Failed to process driver license with both OpenAI and Gemini");
  }
}

/**
 * Validate extracted license data
 */
export function validateLicenseData(data: DriverLicenseData): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!data.license_number?.trim()) {
    errors.push("license_number");
  }
  if (!data.full_name?.trim()) {
    errors.push("full_name");
  }
  if (!data.license_class?.trim()) {
    errors.push("license_class");
  }

  // Validate expiry date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const expiryDate = new Date(data.expiry_date);
    if (isNaN(expiryDate.getTime())) {
      errors.push("expiry_date (invalid date)");
    } else if (expiryDate < today) {
      errors.push("expiry_date (license expired)");
    }
  } catch {
    errors.push("expiry_date (parse error)");
  }

  // Validate date of birth if present
  if (data.date_of_birth) {
    try {
      const dob = new Date(data.date_of_birth);
      if (isNaN(dob.getTime())) {
        errors.push("date_of_birth (invalid)");
      } else {
        // Check if driver is at least 18 years old
        const age = (today.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 18) {
          errors.push("date_of_birth (driver must be 18+)");
        }
      }
    } catch {
      errors.push("date_of_birth (parse error)");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Save license certificate to database
 */
export async function saveLicenseCertificate(
  supabase: SupabaseClient,
  userId: string,
  data: DriverLicenseData,
  mediaUrl: string,
  mediaId: string | null,
  provider: "openai" | "gemini",
  rawOcrData: Record<string, unknown>,
): Promise<{ id: string; error?: string }> {
  const { data: inserted, error } = await supabase
    .from("driver_licenses")
    .insert({
      user_id: userId,
      license_number: data.license_number.toUpperCase(),
      full_name: data.full_name,
      date_of_birth: data.date_of_birth,
      issue_date: data.issue_date,
      expiry_date: data.expiry_date,
      license_class: data.license_class,
      nationality: data.nationality,
      address: data.address,
      gender: data.gender,
      blood_group: data.blood_group,
      license_media_url: mediaUrl,
      license_media_id: mediaId,
      ocr_provider: provider,
      raw_ocr_data: rawOcrData,
      status: "approved", // Auto-approve if validation passed
      is_validated: true,
      validated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("DRIVER_LICENSE_SAVE_ERROR", error);
    return { id: "", error: error.message };
  }

  // Update profile with license info
  await supabase
    .from("profiles")
    .update({ 
      driver_license_number: data.license_number.toUpperCase(),
      driver_license_verified: true,
    })
    .eq("user_id", userId);

  return { id: inserted.id };
}
