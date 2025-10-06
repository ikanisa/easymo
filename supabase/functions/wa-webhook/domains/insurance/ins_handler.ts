import type { RouterContext } from "../../types.ts";
import { ensureProfile } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { toE164 } from "../../utils/phone.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { queueNotification, sendNotificationNow } from "../../notify/sender.ts";
import { fetchInsuranceMedia, uploadInsuranceBytes } from "./ins_media.ts";
import { runInsuranceOCR } from "./ins_ocr.ts";
import { normalizeInsuranceExtraction } from "./ins_normalize.ts";
import {
  buildAdminAlert,
  buildUserErrorMessage,
  buildUserSummary,
} from "./ins_messages.ts";
import type { InsuranceExtraction } from "./ins_normalize.ts";
import { emitAlert } from "../../observe/alert.ts";

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
  userId: string,
): Promise<{ id: string }> {
  const { data, error } = await ctx.supabase
    .from("insurance_leads")
    .insert({
      user_id: userId,
      whatsapp: ctx.from,
      status: "received",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("lead_insert_failed");
  await logStructuredEvent("INS_LEAD_UPDATE_OK", {
    leadId: data.id,
    status: "received",
  });
  return data;
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
  const { error } = await ctx.supabase
    .from("insurance_leads")
    .update({ ...patch, whatsapp: ctx.from })
    .eq("id", leadId);
  if (error) throw error;
  await logStructuredEvent("INS_LEAD_UPDATE_OK", {
    leadId,
    status: patch.status,
  });
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
  const { insurance_admin_numbers } = await getAppConfig(ctx.supabase);
  const admins = Array.isArray(insurance_admin_numbers)
    ? insurance_admin_numbers.filter((value) =>
      typeof value === "string" && value.trim()
    )
    : [];
  if (!admins.length) {
    await logStructuredEvent("INS_ADMIN_NOTIFY_OK", {
      leadId,
      count: 0,
    });
    return;
  }

  const clientDigits = normalizeClientDigits(ctx.from);
  const message = buildAdminAlert(extracted, clientDigits);
  const targets = admins.slice(0, 5).map(normalizeAdminNumber);
  const templateName = Deno.env.get("INSURANCE_ADMIN_TEMPLATE");
  const templateLang = Deno.env.get("INSURANCE_ADMIN_TEMPLATE_LANG") ?? "en";
  const templateEnabled = Boolean(templateName);

  const queuedResults = await Promise.allSettled(
    targets.map((to) =>
      templateEnabled
        ? queueNotification({
          to,
          template: {
            name: templateName!,
            language: templateLang,
            components: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: extracted.registration_plate ?? "—",
                  },
                  {
                    type: "text",
                    text: extracted.policy_number ?? "—",
                  },
                  {
                    type: "text",
                    text: extracted.certificate_number ?? "—",
                  },
                  {
                    type: "text",
                    text: extracted.policy_expiry ?? "—",
                  },
                  {
                    type: "text",
                    text: `https://wa.me/${clientDigits}`,
                  },
                ],
              },
            ],
          },
        }, {
          supabase: ctx.supabase,
          type: ADMIN_ALERT_TYPE,
        })
        : queueNotification({ to, text: message }, {
          supabase: ctx.supabase,
          type: ADMIN_ALERT_TYPE,
        })
    ),
  );

  const notificationIds = queuedResults
    .map((result) => result.status === "fulfilled" ? result.value.id : null)
    .filter((value): value is string => Boolean(value));

  const errors = queuedResults
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  if (notificationIds.length) {
    const sendResults = await Promise.allSettled(
      notificationIds.map((id) => sendNotificationNow(id, ctx.supabase)),
    );
    sendResults
      .filter((result) => result.status === "rejected")
      .forEach((result) => errors.push(result.reason));
  }

  if (errors.length) {
    await logStructuredEvent("INS_ADMIN_NOTIFY_FAIL", {
      leadId,
      count: targets.length,
      error: errors.map((err) =>
        err instanceof Error ? err.message : String(err ?? "unknown")
      ),
    });
    await emitAlert("INS_ADMIN_NOTIFY_FAIL", {
      leadId,
      count: targets.length,
      errors: errors.map((err) =>
        err instanceof Error ? err.message : String(err ?? "unknown")
      ),
    });
  } else {
    await logStructuredEvent("INS_ADMIN_NOTIFY_OK", {
      leadId,
      count: targets.length,
    });
  }
}

export type InsuranceProcessOutcome = "skipped" | "ocr_ok" | "ocr_error";

export async function processInsuranceDocument(
  ctx: RouterContext,
  msg: Record<string, unknown>,
  stateKey: string,
): Promise<InsuranceProcessOutcome> {
  if (stateKey !== "ins_wait_doc" && stateKey !== "insurance_upload") {
    return "skipped";
  }

  const profileId = ctx.profileId ??
    (await ensureProfile(ctx.supabase, ctx.from)).user_id;
  const mediaId = typeof msg?.type === "string"
    ? (msg[msg.type as string] as { id?: string } | undefined)?.id
    : undefined;
  if (!mediaId) return "skipped";

  let leadId = "";
  let ocrAttempted = false;
  try {
    const lead = await upsertLead(ctx, profileId);
    leadId = lead.id;

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
      return await runInsuranceOCR(signedUrl);
    })();
    const duration = Math.round(performance.now() - started);
    await logStructuredEvent("INS_OCR_OK", { leadId, ms: duration });

    const extracted = normalizeInsuranceExtraction(rawOcr);

    await updateLead(ctx, leadId, {
      file_path: path,
      raw_ocr: rawOcr,
      extracted,
      status: "ocr_ok",
      user_id: profileId,
    });

    await sendText(ctx.from, buildUserSummary(extracted));
    await notifyAdmins(ctx, leadId, extracted);
    return "ocr_ok";
  } catch (error) {
    if (leadId) {
      if (ocrAttempted) {
        await logStructuredEvent("INS_OCR_FAIL", {
          leadId,
          error: error instanceof Error
            ? error.message
            : String(error ?? "unknown"),
        });
        await emitAlert("INS_OCR_FAIL", {
          leadId,
          error: error instanceof Error
            ? error.message
            : String(error ?? "unknown"),
        });
      }
      await markLeadError(ctx, leadId, error);
    }
    await sendText(ctx.from, buildUserErrorMessage());
    return "ocr_error";
  }
}
