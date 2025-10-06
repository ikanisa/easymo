import type { RouterContext } from "../../types.ts";
import type { SupabaseClient } from "../../deps.ts";
import { MENU_MEDIA_BUCKET } from "../../config.ts";
import { fetchWhatsAppMedia } from "../../utils/media.ts";
import { logEvent, logStructuredEvent } from "../../observe/log.ts";
import { sendText } from "../../wa/client.ts";
import { findActiveBarNumber } from "../../utils/bar_numbers.ts";

const DEFAULT_FILENAME = "upload.bin";

export async function handleVendorMenuMedia(
  ctx: RouterContext,
  msg: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.from) return false;
  if (msg.type !== "document" && msg.type !== "image") return false;

  const mediaId = (msg[msg.type] as { id?: string } | undefined)?.id;
  if (!mediaId) return false;

  let record;
  try {
    record = await findActiveBarNumber(ctx.supabase, ctx.from);
  } catch (error) {
    console.error("vendor.menu.lookup_fail", error, { from: ctx.from });
    await sendText(
      ctx.from,
      "We couldn't look up your bar. Please try again in a moment or contact support.",
    );
    await logStructuredEvent("VENDOR_MENU_UPLOAD_FAIL", {
      wa_id: `***${ctx.from.slice(-4)}`,
      reason: "lookup_error",
      code: error instanceof Error && "code" in error
        ? (error as { code?: string }).code
        : undefined,
    });
    return true; // consider handled to avoid duplicate processing
  }

  if (!record?.bar_id) {
    console.warn("vendor.menu.no_bar_mapping", {
      from: ctx.from,
      tried: ctx.from,
    });
    await sendText(
      ctx.from,
      'We couldn\'t match this WhatsApp number to a bar. Add the number in the manager menu under "Add WhatsApp numbers" and try again.',
    );
    await logStructuredEvent("VENDOR_MENU_UPLOAD_SKIPPED", {
      wa_id: `***${ctx.from.slice(-4)}`,
      reason: "no_bar_mapping",
    });
    return true;
  }

  try {
    const media = await fetchWhatsAppMedia(mediaId);
    const filename = pickFilename(msg, media.filename, mediaId);
    const path = `${record.bar_id}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await ctx.supabase.storage.from(
      MENU_MEDIA_BUCKET,
    )
      .upload(path, media.bytes, {
        upsert: false,
        contentType: media.mime ?? "application/octet-stream",
      });
    if (uploadError) throw uploadError;

    const { error: insertError } = await ctx.supabase
      .from("ocr_jobs")
      .insert({
        bar_id: record.bar_id,
        source_file_id: path,
        status: "queued",
      });
    if (insertError) throw insertError;

    await logEvent("wa-webhook-vendor-upload", {
      bar_id: record.bar_id,
      wa_id: ctx.from,
      media_id: mediaId,
      storage_path: path,
    });

    await sendText(
      ctx.from,
      "Menu received! We’re processing it now and will notify you when it’s ready.",
    );

    await triggerOcrProcessing(ctx.supabase);
  } catch (err) {
    console.error("vendor.menu.store_fail", err, { mediaId, from: ctx.from });
    await logStructuredEvent("VENDOR_MENU_UPLOAD_FAIL", {
      wa_id: `***${ctx.from.slice(-4)}`,
      reason: err instanceof Error ? err.message : String(err ?? "unknown"),
    });
    await sendText(
      ctx.from,
      "Sorry, we couldn’t process that file. Please try again in a moment.",
    );
  }

  return true;
}

async function triggerOcrProcessing(client: SupabaseClient): Promise<void> {
  try {
    console.log("vendor.menu.ocr_trigger_start");
    const { error } = await client.functions.invoke("ocr-processor");
    if (error) throw error;
    console.log("vendor.menu.ocr_trigger_processor_ok");
    console.log("vendor.menu.ocr_trigger_notifier_skipped");
  } catch (error) {
    if (
      error && typeof error === "object" &&
      "context" in error && error.context && typeof error.context === "object"
    ) {
      const response = error.context as Response;
      let bodyText: string | null = null;
      try {
        bodyText = await response.text();
      } catch (_) {
        bodyText = null;
      }
      console.error("vendor.menu.ocr_trigger_fail", {
        status: response.status,
        statusText: response.statusText,
        body: bodyText,
      });
    } else {
      console.error("vendor.menu.ocr_trigger_fail", error);
    }
  }
}

function pickFilename(
  msg: Record<string, unknown>,
  apiFilename: string | undefined,
  mediaId: string,
): string {
  const candidate =
    (msg.document as { filename?: string } | undefined)?.filename ??
      apiFilename ??
      `${mediaId}.bin`;
  return sanitizeFilename(candidate ?? DEFAULT_FILENAME);
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return DEFAULT_FILENAME;
  return trimmed.replace(/[^A-Za-z0-9._-]/g, "_");
}
