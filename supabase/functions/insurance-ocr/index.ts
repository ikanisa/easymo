import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  MissingOpenAIKeyError,
  runInsuranceOCR,
} from "../_shared/wa-webhook-shared/domains/insurance/ins_ocr.ts";
import { normalizeInsuranceExtraction } from "../_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts";
import { notifyInsuranceAdmins } from "../_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { buildUserSummary } from "../_shared/wa-webhook-shared/domains/insurance/ins_messages.ts";
import { allocateInsuranceBonus } from "../_shared/wa-webhook-shared/wallet/allocate.ts";
import { determineNextStatus } from "./utils.ts";
import { recordRunMetrics } from "./telemetry.ts";

type QueueStatus = "queued" | "processing" | "retry" | "succeeded" | "failed";

type QueueRow = {
  id: string;
  profile_id: string | null;
  wa_id: string | null;
  storage_path: string;
  mime_type: string | null;
  caption: string | null;
  status: QueueStatus;
  created_at: string;
  attempts: number | null;
  last_error: string | null;
  lead_id: string | null;
};

type ProcessResult =
  | { id: string; status: "succeeded"; leadId: string }
  | { id: string; status: "skipped"; reason: string }
  | {
    id: string;
    status: "failed" | "retry";
    error: string;
    leadId: string | null;
  };

const INSURANCE_MEDIA_BUCKET = Deno.env.get("INSURANCE_MEDIA_BUCKET") ??
  "insurance-docs";
const MAX_ATTEMPTS = parsePositiveInt(Deno.env.get("OCR_MAX_ATTEMPTS"), 3);
const SCAN_LIMIT = parsePositiveInt(Deno.env.get("OCR_QUEUE_SCAN_LIMIT"), 5);

let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SERVICE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("insurance-ocr.missing_supabase_config");
  }
  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

function hasAnyOCRProvider(): boolean {
  const hasOpenAI = Boolean(Deno.env.get("OPENAI_API_KEY"));
  const hasGemini = Boolean(Deno.env.get("GEMINI_API_KEY"));
  return hasOpenAI || hasGemini;
}

type InlineRequest = {
  signedUrl: string;
  mime?: string | null;
};

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let inlinePayload: InlineRequest | null = null;
  if (req.method === "POST") {
    try {
      const parsed = await req.json();
      if (
        parsed && typeof parsed === "object" &&
        parsed.inline && typeof parsed.inline.signedUrl === "string"
      ) {
        inlinePayload = parsed.inline as InlineRequest;
      }
    } catch (_) {
      // ignore body parse errors for queue processing
    }
  }

  if (inlinePayload) {
    try {
      const raw = await runInsuranceOCR(
        inlinePayload.signedUrl,
        inlinePayload.mime ?? undefined,
      );
      const normalized = normalizeInsuranceExtraction(raw);
      return json({ raw, normalized });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, 500);
    }
  }

  // Require at least one OCR provider (OpenAI or Gemini)
  if (!hasAnyOCRProvider()) {
    return json(
      {
        error: "no_ocr_provider",
        message:
          "Neither OPENAI_API_KEY nor GEMINI_API_KEY configured; cannot process OCR.",
      },
      503,
    );
  }

  const client = getSupabaseClient();
  const queue = await fetchQueue(client, SCAN_LIMIT);
  if (!queue.length) {
    return json({ processed: [], remaining: 0 });
  }

  const processed: ProcessResult[] = [];

  for (const row of queue) {
    const result = await processQueueRow(client, row);
    processed.push(result);
  }

  const remaining = await countQueued(client);

  await recordRunMetrics(
    processed.map((item) => {
      if (item.status === "succeeded") {
        return { status: "succeeded", outcome: "ok" };
      }
      if (item.status === "skipped") {
        return {
          status: "skipped",
          outcome: "reason" in item ? item.reason : "unknown",
        };
      }
      if (item.status === "retry") {
        return { status: "retry", outcome: "retry" };
      }
      return { status: "failed", outcome: "error" };
    }),
    remaining,
  );

  return json({ processed, remaining });
}

async function fetchQueue(
  client: SupabaseClient,
  limit: number,
): Promise<QueueRow[]> {
  const { data, error } = await client
    .from("insurance_media_queue")
    .select(
      "id, profile_id, wa_id, storage_path, mime_type, caption, status, created_at, attempts, last_error, lead_id",
    )
    .in("status", ["queued", "retry"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("insurance-ocr.fetch_queue_fail", error);
    throw new Error("fetch_queue_failed");
  }

  return data ?? [];
}

async function countQueued(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("insurance_media_queue")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "retry"]);

  if (error) {
    console.error("insurance-ocr.queue_count_fail", error);
    return -1;
  }

  return count ?? 0;
}

async function processQueueRow(
  client: SupabaseClient,
  row: QueueRow,
): Promise<ProcessResult> {
  const now = new Date().toISOString();
  const attempts = (row.attempts ?? 0) + 1;

  const { data: claimed, error: claimError } = await client
    .from("insurance_media_queue")
    .update({
      status: "processing",
      attempts,
      last_attempt_at: now,
    })
    .eq("id", row.id)
    .in("status", ["queued", "retry"])
    .select("id, lead_id, attempts")
    .maybeSingle();

  if (claimError) {
    console.error("insurance-ocr.claim_fail", {
      id: row.id,
      error: claimError.message,
    });
    return { id: row.id, status: "skipped", reason: "claim_failed" };
  }

  if (!claimed) {
    return { id: row.id, status: "skipped", reason: "already_processing" };
  }

  const leadId = claimed.lead_id ?? await ensureLeadForQueue(client, row);

  try {
    const signedUrl = await createSignedUrl(client, row.storage_path);
    const raw = await runInsuranceOCR(signedUrl, row.mime_type ?? undefined);
    const normalized = normalizeInsuranceExtraction(raw);

    await client
      .from("insurance_leads")
      .update({
        raw_ocr: raw,
        extracted: normalized,
        extracted_json: normalized,
        status: "ocr_ok",
      })
      .eq("id", leadId);

    await client
      .from("insurance_media_queue")
      .update({
        status: "succeeded",
        processed_at: now,
        last_error: null,
        lead_id: leadId,
      })
      .eq("id", row.id);

    // Notify insurance admins with extracted data and user contact
    if (row.wa_id) {
      const notifyResult = await notifyInsuranceAdmins(client, {
        leadId,
        userWaId: row.wa_id,
        extracted: normalized,
        documentUrl: signedUrl,
      });

      console.log("insurance-ocr.admin_notify_result", {
        leadId,
        sent: notifyResult.sent,
        failed: notifyResult.failed,
      });
      // Send summary to user
      const userSummary = buildUserSummary(normalized);
      await sendText(row.wa_id, userSummary);
      console.log("insurance-ocr.user_summary_sent", { leadId, waId: row.wa_id });

      // Award insurance bonus tokens (if user has profile)
      if (row.profile_id) {
        try {
          const bonusResult = await allocateInsuranceBonus(
            client,
            row.profile_id,
            leadId,
            2000
          );
          if (bonusResult.success && bonusResult.message) {
            await sendText(row.wa_id, bonusResult.message);
          }
        } catch (bonusError) {
          // Log but don't fail the main flow
          console.warn("INS_BONUS_ALLOCATION_WARN", {
            leadId,
            profileId: row.profile_id,
            error: bonusError instanceof Error ? bonusError.message : String(bonusError),
          });
        }
      }
    } else {
      console.warn("insurance-ocr.no_user_wa_id", { leadId, queueId: row.id });
    }

    return { id: row.id, status: "succeeded", leadId };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error ?? "unknown_error");
    if (error instanceof MissingOpenAIKeyError) {
      await client
        .from("insurance_media_queue")
        .update({
          status: "queued",
          attempts: attempts - 1,
          last_error: message.substring(0, 500),
        })
        .eq("id", row.id);
      console.warn("insurance-ocr.openai_missing", { id: row.id });
      return { id: row.id, status: "skipped", reason: "openai_key_missing" };
    }
    const nextStatus = determineNextStatus(attempts, MAX_ATTEMPTS);
    await client
      .from("insurance_media_queue")
      .update({
        status: nextStatus,
        last_error: message.substring(0, 500),
        processed_at: nextStatus === "failed" ? now : null,
        lead_id: leadId,
      })
      .eq("id", row.id);

    await client
      .from("insurance_leads")
      .update({
        status: "ocr_error",
      })
      .eq("id", leadId);

    console.error("insurance-ocr.process_fail", { id: row.id, message });
    return { id: row.id, status: nextStatus, error: message, leadId };
  }
}

async function ensureLeadForQueue(
  client: SupabaseClient,
  row: QueueRow,
): Promise<string> {
  const { data, error } = await client
    .from("insurance_leads")
    .insert({
      user_id: row.profile_id,
      whatsapp: row.wa_id,
      file_path: row.storage_path,
      status: "received",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("lead_insert_failed");
  }

  if (row.mime_type) {
    await client
      .from("insurance_media")
      .insert({
        lead_id: data.id,
        storage_path: row.storage_path,
        mime_type: row.mime_type,
      });
  }

  await client
    .from("insurance_media_queue")
    .update({ lead_id: data.id })
    .eq("id", row.id);

  return data.id;
}

async function createSignedUrl(
  client: SupabaseClient,
  path: string,
): Promise<string> {
  const trimmed = path.replace(/^\/+/, "");
  const { data, error } = await client.storage
    .from(INSURANCE_MEDIA_BUCKET)
    .createSignedUrl(trimmed, 60 * 10);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("signed_url_missing");
  }
  return data.signedUrl;
}

function parsePositiveInt(
  value: string | undefined | null,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// kept for backward compatibility if used elsewhere
function hasOpenAIKey(): boolean {
  return Boolean(Deno.env.get("OPENAI_API_KEY"));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}
