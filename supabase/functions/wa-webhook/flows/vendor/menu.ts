import type { RouterContext } from "../../types.ts";
import { MENU_MEDIA_BUCKET } from "../../config.ts";
import { fetchWhatsAppMedia } from "../../utils/media.ts";
import { logEvent } from "../../observe/log.ts";

const DEFAULT_FILENAME = "upload.bin";

export async function handleVendorMenuMedia(
  ctx: RouterContext,
  msg: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.from) return false;
  if (msg.type !== "document" && msg.type !== "image") return false;

  const mediaId = (msg[msg.type] as { id?: string } | undefined)?.id;
  if (!mediaId) return false;

  const { data: record, error } = await ctx.supabase
    .from("bar_numbers")
    .select("bar_id")
    .eq("number_e164", ctx.from)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("vendor.menu.lookup_fail", error, { from: ctx.from });
    return true; // consider handled to avoid duplicate processing
  }

  if (!record?.bar_id) {
    return false;
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
  } catch (err) {
    console.error("vendor.menu.store_fail", err, { mediaId, from: ctx.from });
  }

  return true;
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
