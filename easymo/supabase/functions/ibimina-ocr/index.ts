import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o-mini";
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ??
  "https://api.openai.com/v1";
const OCR_API_KEY = Deno.env.get("IBIMINA_OCR_API_KEY") ?? "";
const STORAGE_BUCKET = Deno.env.get("KYC_STORAGE_BUCKET") ?? "kyc-documents";
const SIGNED_URL_TTL_SECONDS = (() => {
  const value = Number(Deno.env.get("KYC_SIGNED_URL_TTL_SECONDS") ?? "604800");
  return Number.isFinite(value) && value > 0 ? value : 604800; // default 7 days
})();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB safety cap per image

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
if (!OPENAI_API_KEY) {
  console.warn(
    "OPENAI_API_KEY is not set; ibimina-ocr will fail until configured",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

interface ImagePayload {
  base64?: string;
  mimeType?: string;
  url?: string;
  filename?: string;
}

interface OcrRequestBody {
  userId: string;
  ikiminaId?: string;
  metadata?: Record<string, unknown>;
  frontImage: ImagePayload;
  backImage?: ImagePayload;
}

interface OcrResult {
  full_name: string;
  id_number: string;
  date_of_birth?: string | null;
  place_of_issue?: string | null;
  expiry_date?: string | null;
  confidence?: number | null;
  field_confidence?: Record<string, number> | null;
}

type Nullable<T> = T | null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function decodeBase64(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function guessExtension(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/heic":
      return "heic";
    default:
      return "bin";
  }
}

function normaliseUserSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 40) || "user";
}

function buildDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function truncate(value: string, max = 4000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number.parseFloat(value.toFixed(4));
}

async function uploadImage(
  client: SupabaseClient,
  image: { base64: string; mimeType: string; filename?: string },
  userId: string,
  suffix: string,
): Promise<{ path: string; signedUrl: string }> {
  const buffer = decodeBase64(image.base64);
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image_too_large_${suffix}`);
  }

  const extension = guessExtension(image.mimeType);
  const safeUserSegment = normaliseUserSegment(userId);
  const fileName = image.filename?.replace(/[^a-zA-Z0-9_.-]/g, "") ||
    `${suffix}.${extension}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path =
    `${safeUserSegment}/${timestamp}-${suffix}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: image.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`storage_upload_failed_${suffix}`);
  }

  const { data: signed, error: signedError } = await client.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed) {
    throw new Error(`storage_signed_url_failed_${suffix}`);
  }

  const signedUrl =
    (signed as { signedUrl?: string; signedURL?: string }).signedUrl ??
      (signed as { signedUrl?: string; signedURL?: string }).signedURL;
  if (!signedUrl) {
    throw new Error(`storage_signed_url_missing_${suffix}`);
  }

  return { path, signedUrl };
}

async function runOpenAiExtraction(
  front: { base64: string; mimeType: string },
  back?: { base64: string; mimeType: string },
): Promise<{ extracted: OcrResult; raw: string }> {
  if (!OPENAI_API_KEY) {
    throw new Error("openai_api_key_missing");
  }

  const userContent: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text:
        "Extract the requested fields from this national identification card.",
    },
    {
      type: "input_image",
      image_url: { url: buildDataUrl(front.base64, front.mimeType) },
    },
  ];

  if (back) {
    userContent.push({
      type: "input_image",
      image_url: { url: buildDataUrl(back.base64, back.mimeType) },
    });
  }

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
                "You extract structured data from Rwandan national ID cards. Always reply with JSON that matches the provided schema. Use null when a value is not present. Confidence values must be between 0 and 1.",
            },
          ],
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rwanda_id_fields",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              full_name: { type: "string" },
              id_number: { type: "string" },
              date_of_birth: {
                type: ["string", "null"],
                description: "YYYY-MM-DD",
              },
              place_of_issue: { type: ["string", "null"] },
              expiry_date: {
                type: ["string", "null"],
                description: "YYYY-MM-DD",
              },
              confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
              field_confidence: {
                type: ["object", "null"],
                additionalProperties: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                },
              },
            },
            required: ["full_name", "id_number"],
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(
      `openai_http_${response.status}_${truncate(errorPayload, 200)}`,
    );
  }

  const json = await response.json();
  const raw = truncate(JSON.stringify(json));
  const text = extractJsonPayload(json);
  let extracted: OcrResult;
  try {
    extracted = JSON.parse(text) as OcrResult;
  } catch (error) {
    throw new Error(`openai_parse_failed_${truncate(String(error), 120)}`);
  }

  return { extracted, raw };
}

function extractJsonPayload(responseJson: Record<string, unknown>): string {
  const output = responseJson?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const asRecord = item as Record<string, unknown>;
      const content = asRecord?.content;
      if (Array.isArray(content)) {
        for (const entry of content) {
          const entryRecord = entry as Record<string, unknown>;
          if (
            entryRecord.type === "output_text" &&
            typeof entryRecord.text === "string"
          ) {
            return entryRecord.text;
          }
          if (
            entryRecord.type === "text" && typeof entryRecord.text === "string"
          ) {
            return entryRecord.text;
          }
        }
      }
    }
  }
  const candidate = responseJson?.output_text;
  if (typeof candidate === "string") return candidate;
  throw new Error("openai_response_missing_text");
}

function normaliseResult(result: OcrResult): OcrResult {
  const fieldConfidence: Record<string, number> | null = result.field_confidence
    ? Object.fromEntries(
      Object.entries(result.field_confidence)
        .filter(([_, value]) => typeof value === "number")
        .map(([key, value]) => [key, clampConfidence(value) ?? 0]),
    )
    : null;

  const fullName = result.full_name?.trim() ?? "";
  const idNumber = result.id_number?.replace(/\s+/g, "").toUpperCase() ?? "";
  const normalisedDob = normaliseDate(result.date_of_birth);
  const normalisedExpiry = normaliseDate(result.expiry_date);

  return {
    full_name: fullName,
    id_number: idNumber,
    date_of_birth: normalisedDob,
    place_of_issue: result.place_of_issue?.trim() ?? null,
    expiry_date: normalisedExpiry,
    confidence: clampConfidence(result.confidence),
    field_confidence: fieldConfidence,
  };
}

function normaliseDate(value: unknown): Nullable<string> {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidates = [trimmed, trimmed.replace(/\//g, "-")];
  for (const candidate of candidates) {
    const match = candidate.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (match) {
      const [_, y, m, d] = match;
      if (
        Number(y) > 1900 && Number(m) >= 1 && Number(m) <= 12 &&
        Number(d) >= 1 && Number(d) <= 31
      ) {
        return `${y}-${m}-${d}`;
      }
    }
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (OCR_API_KEY) {
    const supplied = request.headers.get("x-api-key") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (supplied !== OCR_API_KEY) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
  }

  let payload: OcrRequestBody;
  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  if (!payload?.userId || !payload.frontImage) {
    return jsonResponse({ ok: false, error: "missing_required_fields" }, 400);
  }

  const front = resolveImagePayload(payload.frontImage, "front");
  if (!front) {
    return jsonResponse({ ok: false, error: "invalid_front_image" }, 400);
  }
  const back = payload.backImage
    ? resolveImagePayload(payload.backImage, "back")
    : null;
  if (payload.backImage && !back) {
    return jsonResponse({ ok: false, error: "invalid_back_image" }, 400);
  }

  try {
    const frontUpload = await uploadImage(
      supabase,
      front,
      payload.userId,
      "front",
    );
    const backUpload = back
      ? await uploadImage(supabase, back, payload.userId, "back")
      : null;

    const { extracted, raw } = await runOpenAiExtraction(
      front,
      back ?? undefined,
    );
    const normalised = normaliseResult(extracted);

    const recordPayload: Record<string, unknown> = {
      fields: normalised,
      model: OPENAI_MODEL,
      confidence: normalised.confidence,
      field_confidence: normalised.field_confidence,
      created_at: new Date().toISOString(),
      metadata: payload.metadata ?? null,
      assets: {
        front_path: frontUpload.path,
        back_path: backUpload?.path ?? null,
      },
      raw_response_excerpt: raw,
    };

    if (payload.ikiminaId) {
      recordPayload.ikimina_id = payload.ikiminaId;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("kyc_documents")
      .insert({
        user_id: payload.userId,
        doc_type: "national_id",
        front_url: frontUpload.path,
        back_url: backUpload?.path ?? null,
        status: "pending",
        parsed_json: recordPayload,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("ibimina_ocr.insert_failed", insertError);
      return jsonResponse({ ok: false, error: "kyc_insert_failed" }, 500);
    }

    return jsonResponse({
      ok: true,
      documentId: inserted.id,
      status: "pending",
      parsed: normalised,
      frontUrl: frontUpload.signedUrl,
      backUrl: backUpload?.signedUrl ?? null,
    });
  } catch (error) {
    console.error("ibimina_ocr.error", error);
    const message = error instanceof Error
      ? error.message
      : String(error ?? "unknown_error");
    const status = message.startsWith("openai_http_") ? 502 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
});

function resolveImagePayload(
  image: ImagePayload,
  label: string,
): { base64: string; mimeType: string; filename?: string } | null {
  if (image.base64 && image.mimeType) {
    const cleaned = stripDataUrlPrefix(image.base64);
    if (!isBase64(cleaned)) return null;
    return {
      base64: cleaned,
      mimeType: image.mimeType,
      filename: image.filename,
    };
  }
  if (image.url && image.mimeType) {
    if (!image.url.startsWith("data:")) {
      return null;
    }
    const cleaned = stripDataUrlPrefix(image.url);
    if (!isBase64(cleaned)) return null;
    return {
      base64: cleaned,
      mimeType: image.mimeType,
      filename: image.filename ?? `${label}.${guessExtension(image.mimeType)}`,
    };
  }
  return null;
}

function stripDataUrlPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "");
}

function isBase64(value: string): boolean {
  if (!value || value.length % 4 !== 0) return false;
  try {
    atob(value);
    return true;
  } catch (_error) {
    return false;
  }
}
