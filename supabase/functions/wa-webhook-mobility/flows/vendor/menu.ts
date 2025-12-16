import type { RouterContext } from "../../types.ts";
import type { SupabaseClient } from "../../deps.ts";
import { MENU_MEDIA_BUCKET } from "../../config.ts";
import { fetchWhatsAppMedia } from "../../utils/media.ts";
import {
  logEvent,
  logStructuredEvent,
} from "../../../_shared/observability.ts";
import { sendText } from "../../wa/client.ts";
import { t } from "../../i18n/translator.ts";
import { findActiveBarNumber } from "../../utils/bar_numbers.ts";
import { getState } from "../../../_shared/wa-webhook-shared/state/store.ts";

const DEFAULT_FILENAME = "upload.bin";

export async function handleVendorMenuMedia(
  ctx: RouterContext,
  msg: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.from) return false;
  if (msg.type !== "document" && msg.type !== "image") return false;

  const mediaId = (msg[msg.type] as { id?: string } | undefined)?.id;
  if (!mediaId) return false;

  // Check if user is in restaurant_upload state
  if (ctx.profileId) {
    const state = await getState(ctx.supabase, ctx.profileId);
    if (state.key === "restaurant_upload" && state.data?.barId) {
      return await handleRestaurantMenuUpload(
        ctx,
        msg,
        mediaId,
        state.data.barId as string,
      );
    }
  }

  // Fallback to legacy bar_numbers lookup
  let record;
  try {
    record = await findActiveBarNumber(ctx.supabase, ctx.from);
  } catch (error) {
    logStructuredEvent("VENDOR_MENU_LOOKUP_FAIL", {
      error: error.message,
      from: maskPhone(ctx.from),
      profileId: ctx.profileId,
      operation: "vendor_menu_lookup",
    }, "error");
    await sendText(
      ctx.from,
      t(ctx.locale, "vendor.menu.lookup_fail"),
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
    logStructuredEvent("VENDOR_MENU_NO_BAR_MAPPING", {
      from: ctx.from,
      tried: ctx.from,
    });
    await sendText(
      ctx.from,
      t(ctx.locale, "vendor.menu.no_bar_mapping"),
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

    await logStructuredEvent("wa-webhook-vendor-upload", {
      bar_id: record.bar_id,
      wa_id: ctx.from,
      media_id: mediaId,
      storage_path: path,
    });

    await sendText(
      ctx.from,
      t(ctx.locale, "vendor.menu.received_processing"),
    );

    await triggerOcrProcessing(ctx.supabase);
  } catch (err) {
    await logStructuredEvent("VENDOR_MENU_UPLOAD_FAIL", {
      wa_id: `***${ctx.from.slice(-4)}`,
      reason: err instanceof Error ? err.message : String(err ?? "unknown"),
    });
    await sendText(
      ctx.from,
      t(ctx.locale, "vendor.menu.process_fail"),
    );
  }

  return true;
}

async function handleRestaurantMenuUpload(
  ctx: RouterContext,
  msg: Record<string, unknown>,
  mediaId: string,
  barId: string,
): Promise<boolean> {
  try {
    const media = await fetchWhatsAppMedia(mediaId);
    const filename = pickFilename(msg, media.filename, mediaId);
    const path = `${barId}/${crypto.randomUUID()}-${filename}`;

    // Upload to storage
    const { error: uploadError } = await ctx.supabase.storage.from(
      MENU_MEDIA_BUCKET,
    )
      .upload(path, media.bytes, {
        upsert: false,
        contentType: media.mime ?? "application/octet-stream",
      });
    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: urlData } = ctx.supabase.storage
      .from(MENU_MEDIA_BUCKET)
      .getPublicUrl(path);

    // Create menu upload request
    const fileType = msg.type === "document" ? "pdf" : "image";
    const { error: insertError } = await ctx.supabase
      .from("menu_upload_requests")
      .insert({
        bar_id: barId,
        uploaded_by: ctx.from,
        file_url: urlData.publicUrl,
        file_type: fileType,
        status: "pending",
      });
    if (insertError) throw insertError;

    await logStructuredEvent("RESTAURANT_MENU_UPLOADED", {
      bar_id: barId,
      wa_id: `***${ctx.from.slice(-4)}`,
      media_id: mediaId,
      storage_path: path,
      file_type: fileType,
    });

    await sendText(
      ctx.from,
      t(ctx.locale, "restaurant.menu.upload_processing"),
    );

    // Trigger OCR processing
    await triggerOcrProcessing(ctx.supabase);
  } catch (err) {
    await logStructuredEvent("RESTAURANT_MENU_UPLOAD_FAIL", {
      wa_id: `***${ctx.from.slice(-4)}`,
      reason: err instanceof Error ? err.message : String(err ?? "unknown"),
    });
    await sendText(
      ctx.from,
      t(ctx.locale, "restaurant.menu.upload_error"),
    );
  }

  return true;
}

async function triggerOcrProcessing(client: SupabaseClient): Promise<void> {
  try {
    logStructuredEvent("VENDOR_MENU_OCR_START", {}, "info");
    const { error } = await client.functions.invoke("unified-ocr", {
      body: { domain: "menu" },
    });
    if (error) throw error;
    logStructuredEvent("VENDOR_MENU_OCR_PROCESSOR_OK", {}, "info");
    logStructuredEvent("VENDOR_MENU_OCR_NOTIFIER_SKIPPED", {}, "info");
  } catch (error) {
    if (
      error && typeof error === "object" &&
      "context" in error && error.context && typeof error.context === "object"
    ) {
      const response = error.context as Response;
      let bodyText: string | null = null;
      try {
        bodyText = await response.text();
      } catch {
        bodyText = null;
      }
      logStructuredEvent("VENDOR_MENU_OCR_TRIGGER_FAIL", {
        status: response.status,
        statusText: response.statusText,
        body: bodyText?.slice(0, 200),
      }, "error");
    } else {
      logStructuredEvent("VENDOR_MENU_OCR_TRIGGER_FAIL", {
        error: error instanceof Error ? error.message : String(error),
      }, "error");
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
