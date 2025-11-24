import type { RouterContext } from "../../types.ts";
import { ensureProfile } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { toE164 } from "../../utils/phone.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { fetchInsuranceMedia, uploadInsuranceBytes } from "./ins_media.ts";
import { runInsuranceOCR } from "./ins_ocr.ts";
import { normalizeInsuranceExtraction } from "./ins_normalize.ts";
import { notifyInsuranceAdmins } from "./ins_admin_notify.ts";
import {
  buildAdminAlert,
  buildUserErrorMessage,
  buildUserSummary,
} from "./ins_messages.ts";
import type { InsuranceExtraction } from "./ins_normalize.ts";
import { emitAlert } from "../../observe/alert.ts";
import { supabase as sharedSupabase } from "../../config.ts";
import { allocateInsuranceBonus } from "../wallet/allocate.ts";

const ADMIN_ALERT_TYPE = "insurance_document";

function normalizeClientDigits(e164: string): string {
  return e164.replace(/[^0-9]/g, "");
}

function normalizeAdminNumber(raw: string): string {
  const candidate = toE164(raw);
  return candidate.startsWith("+")
    ? candidate
    : `+${candidate.replace(/[^0-9]/g, "")}`;
}

async function upsertLead(
  ctx: RouterContext,
  userId: string | null,
): Promise<{ id: string }> {
  // Try to reuse a recent open lead within 15 minutes
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recent } = await ctx.supabase
      .from('insurance_leads')
      .select('id, created_at, status')
      .gte('created_at', fifteenMinAgo)
      .eq('whatsapp', ctx.from)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.id) {
      return { id: recent.id };
    }
  } catch (_) {
    // non-fatal
  }

  const basePayload: Record<string, unknown> = { status: "received" };
  if (userId) basePayload.user_id = userId;
  const includeWhatsApp = { ...basePayload, whatsapp: ctx.from };
  const tryInsert = async (p: Record<string, unknown>) =>
    ctx.supabase
      .from("insurance_leads")
      .insert(p)
      .select("id")
      .single();
  let data, error;
  ({ data, error } = await tryInsert(includeWhatsApp));
  if (error) {
    const msg = (error as any)?.message ?? String(error);
    // Handle FK constraint on user_id or column not found
    if (msg.includes("user_id") || msg.includes("violates foreign key constraint")) {
      console.warn("INS_LEAD_USER_ID_FK_FAIL", { userId, error: msg });
      const { user_id, ...rest } = includeWhatsApp as any;
      ({ data, error } = await tryInsert(rest));
    }
  }
  if (error) {
    const msg = (error as any)?.message ?? String(error);
    // Handle whatsapp column issues
    if (msg.includes("'whatsapp'") || msg.includes("whatsapp")) {
      console.warn("INS_LEAD_WHATSAPP_FAIL", { error: msg });
      const { whatsapp, ...rest } = basePayload as any;
      ({ data, error } = await tryInsert(rest));
    }
  }
  if (error || !data) throw error ?? new Error("lead_insert_failed");
  await logStructuredEvent("INS_LEAD_UPDATE_OK", {
    leadId: data.id,
    status: "received",
  });
  return data as { id: string };
}

async function insertMediaRecord(
  ctx: RouterContext,
  leadId: string,
  mediaId: string,
  path: string,
  mime: string,
): Promise<void> {
  const { error } = await ctx.supabase
    .from("insurance_media")
    .insert({
      lead_id: leadId,
      wa_media_id: mediaId,
      storage_path: path,
      mime_type: mime,
    });
  if (error) {
    await logStructuredEvent("INS_UPLOAD_FAIL", {
      leadId,
      path,
      error: error.message,
    });
  }
}

async function updateLead(
  ctx: RouterContext,
  leadId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const table = ctx.supabase.from("insurance_leads");
  const attempt = async (p: Record<string, unknown>) =>
    table.update(p).eq("id", leadId);
  let { error } = await attempt({ ...patch, whatsapp: ctx.from });
  if (error) {
    const msg = (error as any)?.message ?? String(error);
    // Handle FK constraint on user_id
    if (msg.includes("user_id") || msg.includes("violates foreign key constraint")) {
      console.warn("INS_LEAD_UPDATE_USER_ID_FK_FAIL", { leadId, error: msg });
      const { user_id, ...rest } = patch as any;
      ({ error } = await attempt({ ...rest, whatsapp: ctx.from }));
    }
  }
  if (error) {
    const msg = (error as any)?.message ?? String(error);
    if (msg.includes("'whatsapp'") || msg.includes("whatsapp")) {
      console.warn("INS_LEAD_UPDATE_WHATSAPP_FAIL", { leadId, error: msg });
      const { whatsapp, ...rest } = patch as any;
      ({ error } = await attempt(rest));
    }
  }
  if (error) throw error;
  await logStructuredEvent("INS_LEAD_UPDATE_OK", {
    leadId,
    status: patch.status,
  });
}

function mergeExtractions(oldVal: any, newVal: any) {
  const out: Record<string, any> = { ...(oldVal || {}) };
  const src = newVal || {};
  for (const key of Object.keys(src)) {
    if (src[key] !== null && src[key] !== undefined && String(src[key]).trim() !== '') {
      out[key] = src[key];
    }
  }
  return out;
}

async function markLeadError(
  ctx: RouterContext,
  leadId: string,
  reason: unknown,
): Promise<void> {
  try {
    await updateLead(ctx, leadId, {
      status: "ocr_error",
      raw_ocr: null,
      extracted: null,
    });
  } catch (error) {
    await logStructuredEvent("INS_LEAD_UPDATE_OK", {
      leadId,
      status: "ocr_error",
      updateError: error instanceof Error
        ? error.message
        : String(error ?? "unknown"),
    });
  }
}

async function notifyAdmins(
  ctx: RouterContext,
  leadId: string,
  extracted: InsuranceExtraction,
): Promise<void> {
  try {
    // Use new admin notification system with table-based admins
    const result = await notifyInsuranceAdmins(sharedSupabase, {
      leadId,
      userWaId: ctx.from,
      extracted,
    });

    if (result.failed > 0) {
      await logStructuredEvent("INS_ADMIN_NOTIFY_PARTIAL", {
        leadId,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors,
      });
      
      if (result.sent === 0) {
        await emitAlert("INS_ADMIN_NOTIFY_FAIL", {
          leadId,
          errors: result.errors,
        });
      }
    } else {
      await logStructuredEvent("INS_ADMIN_NOTIFY_OK", {
        leadId,
        count: result.sent,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error ?? "unknown");
    await logStructuredEvent("INS_ADMIN_NOTIFY_FAIL", {
      leadId,
      error: msg,
    });
    await emitAlert("INS_ADMIN_NOTIFY_FAIL", { leadId, error: msg });
  }
}

export type InsuranceProcessOutcome = "skipped" | "ocr_ok" | "ocr_error";

async function ensureInsuranceQuote(
  ctx: RouterContext,
  params: {
    leadId: string;
    userId: string | null;
    filePath: string;
    extracted: InsuranceExtraction;
  },
): Promise<void> {
  const uploadedDocs = [params.filePath];
  const insurer = params.extracted.insurer_name ?? null;
  const { error } = await ctx.supabase
    .from("insurance_quotes")
    .upsert({
      id: params.leadId,
      user_id: params.userId,
      uploaded_docs: uploadedDocs,
      insurer,
      status: "pending",
      reviewer_comment: null,
      // created_at defaults; updated_at handled by DB if available
    }, { onConflict: "id" });
  if (error) {
    await logStructuredEvent("INS_QUOTES_UPSERT_FAIL", {
      leadId: params.leadId,
      error: error.message,
    });
  } else {
    await logStructuredEvent("INS_QUOTES_UPSERT_OK", {
      leadId: params.leadId,
      insurer,
    });
  }
}

async function maybeEnqueueForWorker(
  ctx: RouterContext,
  leadId: string,
  filePath: string,
  mime: string,
): Promise<void> {
  // Default mirroring ON (no secret needed). Set INSURANCE_QUEUE_MIRROR=false to disable.
  const mirrorFlag = (Deno.env.get("INSURANCE_QUEUE_MIRROR") ?? "true")
    .toLowerCase();
  if (mirrorFlag === "0" || mirrorFlag === "false") return;
  try {
    await ctx.supabase.from("insurance_media_queue").insert({
      profile_id: ctx.profileId ?? null,
      wa_id: ctx.from,
      storage_path: filePath,
      mime_type: mime,
      caption: null,
      status: "queued",
      lead_id: leadId,
    });
  } catch (err) {
    console.warn("INS_QUEUE_ENQUEUE_FAIL", {
      leadId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    // Fire-and-forget: attempt to wake the worker; ignore errors
    await sharedSupabase.functions.invoke("insurance-ocr");
  } catch (_err) {
    /* noop */
  }
}

export async function processInsuranceDocument(
  ctx: RouterContext,
  msg: Record<string, unknown>,
  stateKey: string,
): Promise<InsuranceProcessOutcome> {
  // Accept uploads from the explicit insurance states, and be permissive when
  // users send a document from the home screen. This avoids silently dropping
  // valid document uploads when the user hasn't opened the insurance menu yet.
  if (
    stateKey !== "ins_wait_doc" &&
    stateKey !== "insurance_upload" &&
    stateKey !== "insurance_menu" &&
    stateKey !== "home"
  ) {
    return "skipped";
  }

  // Resolve or create profile, but don't fail the entire flow if MSISDN gates are strict.
  let profileId: string | null = ctx.profileId ?? null;
  if (!profileId) {
    try {
      const profile = await ensureProfile(ctx.supabase, ctx.from);
      profileId = profile.user_id;
    } catch (err) {
      const msg = (err && typeof err === "object" && (err as any).message)
        ? (err as any).message
        : String(err ?? "unknown");
      await logStructuredEvent("INS_PROFILE_RESOLVE_FAIL", {
        from: ctx.from,
        error: msg,
      });
      // Continue with null profileId; tables accept null user_id
      profileId = null;
    }
  }
  const mediaId = typeof msg?.type === "string"
    ? (msg[msg.type as string] as { id?: string } | undefined)?.id
    : undefined;
  if (!mediaId) return "skipped";

  let leadId = "";
  let ocrAttempted = false;
  try {
    console.info("INS_LEAD_UPSERT_START", { from: ctx.from, profileId });
    const lead = await upsertLead(ctx, profileId);
    leadId = lead.id;
    console.info("INS_LEAD_UPSERT_OK", { leadId });

    const media = await fetchInsuranceMedia(mediaId, leadId);
    const { path, signedUrl } = await uploadInsuranceBytes(
      ctx.supabase,
      leadId,
      media,
    );
    await insertMediaRecord(ctx, leadId, mediaId, path, media.mime);

    const started = performance.now();
    const rawOcr = await (async () => {
      ocrAttempted = true;
      return await runInsuranceOCR(signedUrl, media.mime);
    })();
    const duration = Math.round(performance.now() - started);
    console.info("INS_OCR_OK", { leadId, ms: duration });
    await logStructuredEvent("INS_OCR_OK", { leadId, ms: duration });

    const extracted = normalizeInsuranceExtraction(rawOcr);

    // Merge with existing extraction if present (multi-page aggregation)
    try {
      const { data: current } = await ctx.supabase
        .from('insurance_leads')
        .select('extracted')
        .eq('id', leadId)
        .maybeSingle();
      if (current?.extracted) {
        const merged = mergeExtractions(current.extracted, extracted);
        (patch as any) = { ...patch, extracted: merged };
      }
    } catch (_) { /* non-fatal */ }

    await updateLead(ctx, leadId, {
      file_path: path,
      raw_ocr: rawOcr,
      extracted,
      status: "ocr_ok",
      user_id: profileId,
    });

    // Ensure admin panel sync via insurance_quotes
    await ensureInsuranceQuote(ctx, {
      leadId,
      userId: profileId,
      filePath: path,
      extracted,
    });

    // Optional background mirror to worker queue for redundancy/audit
    await maybeEnqueueForWorker(ctx, leadId, path, media.mime);

    const summary = buildUserSummary(extracted);
    console.info("INS_USER_SUMMARY_SEND", { leadId });
    await sendText(ctx.from, summary);
    await notifyAdmins(ctx, leadId, extracted);
    
    // Award insurance bonus tokens (if user has profile)
    if (profileId) {
      try {
        const bonusResult = await allocateInsuranceBonus(
          ctx.supabase,
          profileId,
          leadId,
          2000
        );
        if (bonusResult.success && bonusResult.message) {
          await sendText(ctx.from, bonusResult.message);
        }
      } catch (bonusError) {
        // Log but don't fail the main flow
        console.warn("INS_BONUS_ALLOCATION_WARN", {
          leadId,
          profileId,
          error: bonusError instanceof Error ? bonusError.message : String(bonusError),
        });
      }
    }
    
    return "ocr_ok";
  } catch (error) {
    const errMsg =
      (error && typeof error === "object" && (error as any).message)
        ? (error as any).message
        : String(error ?? "unknown_error");
    console.error("INS_PROCESS_ERROR", {
      leadId: leadId || null,
      error: errMsg,
    });
    if (leadId) {
      if (ocrAttempted) {
        await logStructuredEvent("INS_OCR_FAIL", {
          leadId,
          error: errMsg,
        });
        await emitAlert("INS_OCR_FAIL", {
          leadId,
          error: errMsg,
        });
      }
      await markLeadError(ctx, leadId, error);
    }
    await sendText(ctx.from, buildUserErrorMessage());
    return "ocr_error";
  }
}

/**
 * Handle insurance help request - show admin contacts
 */
export async function handleInsuranceHelp(ctx: RouterContext): Promise<boolean> {
  const { sendListMessage } = await import("../../utils/reply.ts");
  const { IDS } = await import("../../wa/ids.ts");
  
  const { data: contacts } = await ctx.supabase
    .from('insurance_admin_contacts')
    .select('id, contact_type, contact_value, display_name, is_active')
    .eq('is_active', true)
    .order('display_order');

  if (!contacts || contacts.length === 0) {
    await sendListMessage(
      ctx,
      {
        title: '🏥 Insurance Support',
        body: 'Insurance support contacts are currently unavailable. Please try again later.',
        sectionTitle: 'Support',
        rows: [{ id: IDS.BACK_MENU, title: 'Back' }],
        buttonText: 'Open'
      },
      { emoji: '🏥' }
    );
    return true;
  }

  const rows = contacts
    .filter((c: any) => String(c.contact_type || '').toLowerCase() === 'whatsapp')
    .map((c: any) => ({ id: `insurance_contact_${c.id}`, title: c.display_name.substring(0, 24), description: c.contact_value }))
    .slice(0, 10);

  await sendListMessage(
    ctx,
    {
      title: '🏥 Insurance Support',
      body: 'Contact our support team for assistance. Tap a contact below to start chatting on WhatsApp.',
      sectionTitle: 'Contacts',
      rows: [...rows, { id: IDS.BACK_MENU, title: 'Back to Menu' }],
      buttonText: 'Choose'
    },
    { emoji: '🏥' }
  );

  await logStructuredEvent('INSURANCE_HELP_REQUESTED', { profile_id: ctx.profileId, wa_id: ctx.from });
  return true;
}
