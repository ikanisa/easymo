/**
 * Insurance Domain Handler
 * Processes insurance certificate OCR requests
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { runOpenAIVision } from "../core/openai.ts";
import { runGeminiVision } from "../core/gemini.ts";
import { fetchQueuedJobs, claimJob, updateJobStatus, countQueuedJobs, determineNextStatus } from "../core/queue.ts";
import { createSignedUrl } from "../core/storage.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { normalizeInsuranceExtraction } from "../../_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts";
import { notifyInsuranceAdmins } from "../../_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { buildUserSummary } from "../../_shared/wa-webhook-shared/domains/insurance/ins_messages.ts";
import { allocateInsuranceBonus } from "../../_shared/wa-webhook-shared/wallet/allocate.ts";
import { INSURANCE_SCHEMA } from "../schemas/insurance.ts";

const INSURANCE_MEDIA_BUCKET = Deno.env.get("INSURANCE_MEDIA_BUCKET") ?? "insurance-docs";
const MAX_ATTEMPTS = 3;

/**
 * Process insurance queue (batch mode)
 */
export async function processInsuranceQueue(
  client: SupabaseClient,
  limit: number,
): Promise<Response> {
  const jobs = await fetchQueuedJobs(client, {
    tableName: "insurance_media_queue",
    maxAttempts: MAX_ATTEMPTS,
    scanLimit: limit,
  });

  if (!jobs.length) {
    return jsonResponse({ processed: [], remaining: 0 });
  }

  const processed = [];

  for (const job of jobs) {
    const result = await processInsuranceJob(client, job);
    processed.push(result);
  }

  const remaining = await countQueuedJobs(client, {
    tableName: "insurance_media_queue",
    maxAttempts: MAX_ATTEMPTS,
    scanLimit: limit,
  });

  return jsonResponse({ processed, remaining });
}

/**
 * Process inline insurance OCR request
 */
export async function processInsuranceInline(
  client: SupabaseClient,
  payload: { signedUrl: string; mime?: string },
): Promise<Response> {
  try {
    const raw = await runInsuranceOCR(payload.signedUrl, payload.mime);
    const normalized = normalizeInsuranceExtraction(raw);

    await logStructuredEvent("INS_OCR_INLINE_SUCCESS", {}, "info");

    return jsonResponse({
      domain: "insurance",
      raw,
      normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logStructuredEvent("INS_OCR_INLINE_ERROR", { error: message }, "error");
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * Process single insurance job from queue
 */
async function processInsuranceJob(
  client: SupabaseClient,
  job: any,
): Promise<any> {
  const attempts = (job.attempts ?? 0) + 1;

  // Check if already exceeded max attempts
  if (attempts > MAX_ATTEMPTS) {
    await updateJobStatus(client, {
      tableName: "insurance_media_queue",
      maxAttempts: MAX_ATTEMPTS,
      scanLimit: 0,
    }, job.id, "failed", {
      last_error: `Exceeded max attempts (${MAX_ATTEMPTS})`,
    });
    return { id: job.id, status: "failed", error: "max_attempts_exceeded" };
  }

  // Try to claim the job
  const claimed = await claimJob(client, {
    tableName: "insurance_media_queue",
    maxAttempts: MAX_ATTEMPTS,
    scanLimit: 0,
  }, job.id, job.attempts ?? 0);

  if (!claimed) {
    return { id: job.id, status: "skipped", reason: "already_processing" };
  }

  // Check if lead already processed
  if (job.lead_id) {
    const { data: lead } = await client
      .from("insurance_leads")
      .select("status")
      .eq("id", job.lead_id)
      .maybeSingle();

    if (lead?.status === "ocr_ok") {
      await updateJobStatus(client, {
        tableName: "insurance_media_queue",
        maxAttempts: MAX_ATTEMPTS,
        scanLimit: 0,
      }, job.id, "succeeded");
      return { id: job.id, status: "skipped", reason: "already_processed" };
    }
  }

  // Ensure lead exists
  const leadId = job.lead_id ?? await ensureInsuranceLead(client, job);

  try {
    // Get signed URL and run OCR
    const signedUrl = await createSignedUrl(client, INSURANCE_MEDIA_BUCKET, job.storage_path);
    const raw = await runInsuranceOCR(signedUrl, job.mime_type);
    const normalized = normalizeInsuranceExtraction(raw);

    // Update lead with extraction
    await client
      .from("insurance_leads")
      .update({
        raw_ocr: raw,
        extracted: normalized,
        status: "ocr_ok",
      })
      .eq("id", leadId);

    // Mark job as succeeded
    await updateJobStatus(client, {
      tableName: "insurance_media_queue",
      maxAttempts: MAX_ATTEMPTS,
      scanLimit: 0,
    }, job.id, "succeeded", {
      lead_id: leadId,
      last_error: null,
    });

    // Send notifications
    if (job.wa_id) {
      await notifyInsuranceAdmins(client, {
        leadId,
        userWaId: job.wa_id,
        extracted: normalized,
        documentUrl: signedUrl,
      });

      const userSummary = buildUserSummary(normalized);
      await sendText(job.wa_id, userSummary);

      // Allocate bonus
      if (job.profile_id) {
        await allocateInsuranceBonus(client, job.profile_id, leadId, 2000);
      }
    }

    return { id: job.id, status: "succeeded", leadId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = determineNextStatus(attempts, MAX_ATTEMPTS);

    await updateJobStatus(client, {
      tableName: "insurance_media_queue",
      maxAttempts: MAX_ATTEMPTS,
      scanLimit: 0,
    }, job.id, nextStatus, {
      last_error: message.substring(0, 500),
      lead_id: leadId,
    });

    await client
      .from("insurance_leads")
      .update({ status: "ocr_error" })
      .eq("id", leadId);

    await logStructuredEvent("INS_OCR_JOB_FAIL", {
      jobId: job.id,
      leadId,
      error: message,
    }, "error");

    return { id: job.id, status: nextStatus, error: message, leadId };
  }
}

/**
 * Run insurance OCR with provider fallback
 */
async function runInsuranceOCR(imageUrl: string, mimeType?: string): Promise<any> {
  const prompt = buildInsurancePrompt();

  try {
    // Try OpenAI first
    const response = await runOpenAIVision({
      imageBase64: await urlToBase64(imageUrl),
      contentType: mimeType ?? "image/jpeg",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      schema: INSURANCE_SCHEMA,
    });
    return response.parsed;
  } catch (error) {
    // Fallback to Gemini
    await logStructuredEvent("INS_OCR_OPENAI_FAIL_FALLBACK", {
      error: error instanceof Error ? error.message : String(error),
    }, "warn");

    const response = await runGeminiVision({
      imageBase64: await urlToBase64(imageUrl),
      contentType: mimeType ?? "image/jpeg",
      prompt: `${prompt.system}\n\n${prompt.user}`,
    });
    return response.parsed;
  }
}

async function ensureInsuranceLead(client: SupabaseClient, job: any): Promise<string> {
  const { data, error } = await client
    .from("insurance_leads")
    .insert({
      user_id: job.profile_id,
      whatsapp: job.wa_id,
      file_path: job.storage_path,
      status: "received",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create insurance lead: ${error?.message}`);
  }

  await client
    .from("insurance_media_queue")
    .update({ lead_id: data.id })
    .eq("id", job.id);

  return data.id;
}

async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function buildInsurancePrompt() {
  return {
    system: "You are an expert at extracting information from insurance certificates. Extract all policy details accurately.",
    user: "Extract: policy_no, insurer, effective_from (YYYY-MM-DD), expires_on (YYYY-MM-DD), coverage_amount, beneficiary. Return as JSON.",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
