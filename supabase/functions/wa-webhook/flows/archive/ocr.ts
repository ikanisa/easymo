import type { RouterContext, WhatsAppMessage } from "../../types.ts";
import { fetchWhatsAppMedia } from "../../utils/media.ts";
import { queueNotification } from "../../notify/sender.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { normalizeWaId } from "../../exchange/admin/auth.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { INSURANCE_MEDIA_BUCKET } from "../../config.ts";
import { IDS } from "../../wa/ids.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
} from "../../utils/reply.ts";
import { resolveOpenAiResponseText } from "../../../_shared/wa-webhook-shared/utils/openai_responses.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-5";  // Per README.md: Use GPT-5 (but prefer Gemini-3 for vision)
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL") ??
  "https://api.openai.com/v1";

const OCR_PROMPT =
  `You are an assistant that extracts structured data from motor insurance certificates.
Return a JSON object with these keys:
- insurer (string)
- policy_number (string)
- vehicle_plate (string)
- vehicle_model (string)
- owner_name (string)
- coverage (string)
- issue_date (ISO 8601 date or null)
- expiry_date (ISO 8601 date or null)
- chassis_vin (string)
- notes (string) additional important details
If a field is missing or unreadable, use null.
`;

const THANK_YOU_COPY =
  "🛡️ Insurance upload received! Our team will review and reach out shortly.";
const RETRY_COPY =
  "⚠️ Upload failed. Please send a clearer photo/PDF (tap ➕ → Document/Photo).";

export async function startInsurance(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  await sendButtonsMessage(
    ctx,
    "🛡️ 🛡️ Share a clear photo or PDF of your insurance certificate or Carte Jaune. Tap ➕ then choose Document or Photo.",
    homeOnly(),
    { emoji: "🛡️" },
  );
  return true;
}

export async function handleInsuranceMedia(
  ctx: RouterContext,
  msg: WhatsAppMessage,
): Promise<boolean> {
  const doc = asRecord<WhatsAppMediaDocument>(msg.document);
  const image = asRecord<WhatsAppMediaImage>(msg.image);
  const mediaId = (typeof doc?.id === "string" ? doc.id : null) ??
    (typeof image?.id === "string" ? image.id : null);
  if (!mediaId) return false;

  let caption = "";
  let storagePath: string | null = null;
  let leadId: string | null = null;

  try {
    const filename = typeof doc?.filename === "string" ? doc.filename : null;
    const docCaption = typeof doc?.caption === "string" ? doc.caption : null;
    const imageCaption = typeof image?.caption === "string"
      ? image.caption
      : null;
    caption = filename ?? imageCaption ?? docCaption ?? "";
    const media = await fetchWhatsAppMedia(mediaId);
    storagePath = await uploadInsuranceMedia(
      ctx,
      media.bytes,
      media.mime,
      media.filename,
    );

    leadId = await recordInsuranceLead(ctx, {
      storagePath,
      caption,
      raw: null,
      extracted: null,
      status: OPENAI_API_KEY ? "received" : "reviewed",
    });

    await logStructuredEvent("INSURANCE_UPLOAD_STORED", {
      wa_id: ctx.from,
      path: storagePath,
      caption,
      lead_id: leadId,
    });

    if (!OPENAI_API_KEY) {
      await notifyManualReview(ctx, storagePath, caption);
      await sendButtonsMessage(
        ctx,
        THANK_YOU_COPY,
        buildButtons({
          id: IDS.MOTOR_INSURANCE_UPLOAD,
          title: "📎 Upload again",
        }),
      );
      return true;
    }

    const extraction = await performInsuranceOcr(media.bytes, media.mime);
    extraction.summary.storage_path = storagePath;

    await ctx.supabase
      .from("insurance_leads")
      .update({
        raw_ocr: extraction.raw,
        extracted: extraction.summary,
        extracted_json: extraction.summary,
        status: "ocr_ok",
      })
      .eq("id", leadId);

    await saveInsuranceSummary(ctx, leadId, extraction.summary);

    await notifyInsuranceAdmins(ctx, extraction.summary, storagePath, caption);

    const userSummary = formatUserSummary(extraction.summary);
    await sendButtonsMessage(
      ctx,
      userSummary,
      buildButtons({
        id: IDS.MOTOR_INSURANCE_UPLOAD,
        title: "📎 Upload another",
      }),
      { emoji: "🛡️" },
    );
    await logStructuredEvent("INSURANCE_UPLOAD_OCR_OK", {
      wa_id: ctx.from,
      lead_id: leadId,
    });
    return true;
  } catch (error) {
    console.error("insurance.ocr_fail", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logStructuredEvent("INSURANCE_UPLOAD_ERROR", {
      wa_id: ctx.from,
      error: errorMessage,
      lead_id: leadId,
    });

    if (leadId) {
      const { error: statusError } = await ctx.supabase
        .from("insurance_leads")
        .update({ status: "ocr_error" })
        .eq("id", leadId);
      if (statusError) {
        console.error("insurance.lead_status_fail", statusError);
      }
    }

    if (storagePath) {
      await notifyInsuranceAdmins(
        ctx,
        {
          insurer: null,
          policy_number: null,
          vehicle_plate: null,
          vehicle_model: null,
          owner_name: null,
          coverage: null,
          issue_date: null,
          expiry_date: null,
          chassis_vin: null,
          notes: `OCR failed: ${errorMessage}`,
          storage_path: storagePath,
        },
        storagePath,
        caption,
      );
    }

    await sendButtonsMessage(
      ctx,
      RETRY_COPY,
      buildButtons({
        id: IDS.MOTOR_INSURANCE_UPLOAD,
        title: "📎 Retry upload",
      }),
    );
    return true;
  }
}

async function uploadInsuranceMedia(
  ctx: RouterContext,
  bytes: Uint8Array,
  mime: string,
  filename?: string,
): Promise<string> {
  const name = filename?.replace(/[^A-Za-z0-9._-]/g, "") || "insurance";
  const path = `${ctx.profileId ?? "anon"}/${crypto.randomUUID()}-${name}`;
  const options = {
    cacheControl: "3600",
    upsert: false,
    contentType: mime || "application/octet-stream",
  } as const;
  const bucket = ctx.supabase.storage.from(INSURANCE_MEDIA_BUCKET);
  let { error } = await bucket.upload(path, bytes, options);
  if (error && error.message?.toLowerCase().includes("bucket not found")) {
    const { error: createError } = await ctx.supabase.storage.createBucket(
      INSURANCE_MEDIA_BUCKET,
      {
        public: false,
      },
    );
    if (
      createError &&
      !createError.message?.toLowerCase().includes("already exists")
    ) {
      throw createError;
    }
    await logStructuredEvent("INSURANCE_BUCKET_CREATED", {
      bucket: INSURANCE_MEDIA_BUCKET,
    });
    const retry = await bucket.upload(path, bytes, options);
    error = retry.error;
  }
  if (error) throw error;
  return path;
}

async function recordInsuranceLead(
  ctx: RouterContext,
  params: {
    storagePath: string;
    caption: string;
    raw: unknown;
    extracted: unknown;
    status: "received" | "ocr_ok" | "reviewed" | "ocr_error";
  },
): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("insurance_leads")
    .insert({
      whatsapp: ctx.from,
      file_path: params.storagePath,
      raw_ocr: params.raw,
      extracted: params.extracted,
      status: params.status,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function saveInsuranceSummary(
  ctx: RouterContext,
  leadId: string,
  summary: InsuranceSummary,
): Promise<void> {
  try {
    const { error } = await ctx.supabase
      .from("insurance_media")
      .insert({
        lead_id: leadId,
        storage_path: summary.storage_path ?? null,
      });
    if (error && error.code !== "23505") {
      console.error("insurance.media_insert_fail", error);
    }
  } catch (error) {
    console.error("insurance.media_insert_fail", error);
  }
}

async function notifyManualReview(
  ctx: RouterContext,
  storagePath: string,
  caption: string,
): Promise<void> {
  await notifyInsuranceAdmins(
    ctx,
    {
      insurer: null,
      policy_number: null,
      vehicle_plate: null,
      owner_name: null,
      coverage: null,
      issue_date: null,
      expiry_date: null,
      chassis_vin: null,
      notes: caption || null,
      storage_path: storagePath,
    },
    storagePath,
    caption,
  );
}

async function notifyInsuranceAdmins(
  ctx: RouterContext,
  summary: InsuranceSummary,
  storagePath: string,
  caption: string,
): Promise<void> {
  try {
    const config = await getAppConfig(ctx.supabase);
    const admins = [...new Set(config.insurance_admin_numbers ?? [])]
      .filter((value): value is string =>
        typeof value === "string" && value.trim().length > 0
      )
      .map((value) => normalizeWaId(value))
      .filter((value) => value.length > 4);
    if (!admins.length) return;
    const message = formatAdminSummary(
      normalizeWaId(ctx.from),
      summary,
      storagePath,
      caption,
    );
    await Promise.allSettled(
      admins.slice(0, 8).map((to) =>
        queueNotification({ to, text: message }, {
          type: "insurance_upload",
        })
      ),
    );
  } catch (error) {
    console.error("insurance.admin_notify_fail", error);
  }
}

type WhatsAppMediaDocument = {
  id?: string;
  filename?: string;
  caption?: string;
};

type WhatsAppMediaImage = {
  id?: string;
  caption?: string;
};

async function performInsuranceOcr(
  bytes: Uint8Array,
  mime: string,
): Promise<{ raw: unknown; summary: InsuranceSummary }> {
  const base64 = btoa(String.fromCharCode(...bytes));
  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: OCR_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract the policy details from this insurance certificate.",
            },
            {
              type: "input_image",
              image_url: {
                url: `data:${
                  mime || "application/octet-stream"
                };base64,${base64}`,
              },
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          json_schema: {
            name: "insurance_certificate_payload",
            schema: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${text}`);
  }

  const payload = await response.json();
  const helperContent = resolveOpenAiResponseText(payload);
  if (helperContent && helperContent.trim().length) {
    const parsedHelper = safeJson(helperContent) ?? {};
    return {
      raw: helperContent,
      summary: normalizeSummary(parsedHelper),
    };
  }
  const raw = typeof payload?.output_text === "string" &&
      payload.output_text.trim().length
    ? payload.output_text
    : payload.output?.[0]?.content ?? payload.choices?.[0]?.message?.content ??
      payload;
  const parsed = safeJson(raw);
  return {
    raw,
    summary: normalizeSummary(parsed ?? {}),
  };
}

function asRecord<T extends Record<string, unknown>>(value: unknown): T | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }
  return null;
}

function safeJson(raw: string | unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function normalizeSummary(input: Record<string, unknown>): InsuranceSummary {
  return {
    insurer: pickString(input.insurer),
    policy_number: pickString(input.policy_number),
    vehicle_plate: pickString(input.vehicle_plate),
    vehicle_model: pickString(input.vehicle_model),
    owner_name: pickString(input.owner_name),
    coverage: pickString(input.coverage),
    issue_date: pickString(input.issue_date),
    expiry_date: pickString(input.expiry_date),
    chassis_vin: pickString(input.chassis_vin),
    notes: pickString(input.notes),
    storage_path: pickString(input.storage_path),
  };
}

function pickString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length) return value.trim();
  return null;
}

function formatUserSummary(summary: InsuranceSummary): string {
  const lines = [
    "🛡️ Insurance summary:",
  ];
  if (summary.policy_number) lines.push(`• Policy: *${summary.policy_number}*`);
  if (summary.insurer) lines.push(`• Insurer: ${summary.insurer}`);
  if (summary.vehicle_plate) lines.push(`• Plate: ${summary.vehicle_plate}`);
  if (summary.vehicle_model) lines.push(`• Vehicle: ${summary.vehicle_model}`);
  if (summary.expiry_date) lines.push(`• Expires: ${summary.expiry_date}`);
  if (summary.coverage) lines.push(`• Cover: ${summary.coverage}`);
  if (summary.notes) lines.push(`• Notes: ${summary.notes}`);
  lines.push("Our team will contact you shortly. Reply HELP for assistance.");
  return lines.join("\n");
}

function formatAdminSummary(
  fromWa: string,
  summary: InsuranceSummary,
  storagePath: string,
  caption: string,
): string {
  const lines = [
    `🛡️ New insurance upload from ${fromWa}`,
    `• File: ${storagePath}`,
  ];
  if (caption) lines.push(`• Caption: ${caption}`);
  if (summary.policy_number) lines.push(`• Policy: ${summary.policy_number}`);
  if (summary.insurer) lines.push(`• Insurer: ${summary.insurer}`);
  if (summary.vehicle_plate) lines.push(`• Plate: ${summary.vehicle_plate}`);
  if (summary.vehicle_model) lines.push(`• Vehicle: ${summary.vehicle_model}`);
  if (summary.owner_name) lines.push(`• Owner: ${summary.owner_name}`);
  if (summary.coverage) lines.push(`• Cover: ${summary.coverage}`);
  if (summary.issue_date) lines.push(`• Issued: ${summary.issue_date}`);
  if (summary.expiry_date) lines.push(`• Expires: ${summary.expiry_date}`);
  if (summary.chassis_vin) lines.push(`• VIN: ${summary.chassis_vin}`);
  if (summary.notes) lines.push(`• Notes: ${summary.notes}`);
  lines.push("Review in Admin › Insurance leads 💼");
  return lines.join("\n");
}

interface InsuranceSummary {
  insurer: string | null;
  policy_number: string | null;
  vehicle_plate: string | null;
  vehicle_model?: string | null;
  owner_name: string | null;
  coverage: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  chassis_vin: string | null;
  notes: string | null;
  storage_path?: string | null;
}
