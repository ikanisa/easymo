import type { SupabaseClient } from "../../deps.ts";
import { INSURANCE_MEDIA_BUCKET } from "../../config.ts";
import { fetchWhatsAppMedia } from "../../utils/media.ts";
import { logStructuredEvent } from "../../observe/log.ts";

export type MediaFetchResult = {
  bytes: Uint8Array;
  mime: string;
  filename?: string;
  extension: string;
};

const DEFAULT_EXTENSION = "bin";

function resolveExtension(mime: string, filename?: string): string {
  const lowerName = filename?.toLowerCase();
  if (lowerName?.endsWith(".pdf")) return "pdf";
  if (lowerName?.endsWith(".png")) return "png";
  if (lowerName?.endsWith(".jpg") || lowerName?.endsWith(".jpeg")) {
    return "jpg";
  }
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return DEFAULT_EXTENSION;
}

export async function fetchInsuranceMedia(
  mediaId: string,
  leadId: string,
): Promise<MediaFetchResult> {
  try {
    console.info("INS_MEDIA_META_FETCH", { leadId, mediaId });
    const media = await fetchWhatsAppMedia(mediaId);
    const extension = resolveExtension(media.mime, media.filename);
    console.info("INS_MEDIA_META_OK", {
      leadId,
      mime: media.mime,
      filename: media.filename ?? null,
      extension,
    });
    await logStructuredEvent("INS_MEDIA_FETCH_OK", {
      leadId,
      mediaId,
      mime: media.mime,
      extension,
    });
    return { ...media, extension };
  } catch (error) {
    console.error("INS_MEDIA_META_FAIL", {
      leadId,
      mediaId,
      error: error instanceof Error ? error.message : String(error),
    });
    await logStructuredEvent("INS_MEDIA_FETCH_FAIL", {
      leadId,
      mediaId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function uploadInsuranceBytes(
  client: SupabaseClient,
  leadId: string,
  file: MediaFetchResult,
): Promise<{ path: string; signedUrl: string }> {
  const relativePath = `${leadId}/${crypto.randomUUID()}.${file.extension}`;
  try {
    console.info("INS_MEDIA_UPLOAD_START", {
      leadId,
      path: relativePath,
      mime: file.mime,
      bytes: file.bytes.length,
    });
    const { error } = await client.storage
      .from(INSURANCE_MEDIA_BUCKET)
      .upload(relativePath, file.bytes, {
        contentType: file.mime,
        upsert: false,
      });
    if (error) throw error;

    const { data: signed, error: signedError } = await client.storage
      .from(INSURANCE_MEDIA_BUCKET)
      .createSignedUrl(relativePath, 300, {
        transform: undefined,
      });
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error("signed_url_missing");
    }

    console.info("INS_MEDIA_UPLOAD_OK", { leadId, path: relativePath });
    await logStructuredEvent("INS_UPLOAD_OK", {
      leadId,
      path: relativePath,
      size: file.bytes.length,
      mime: file.mime,
    });

    return { path: relativePath, signedUrl: signed.signedUrl };
  } catch (error) {
    console.error("INS_MEDIA_UPLOAD_FAIL", {
      leadId,
      path: relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
    await logStructuredEvent("INS_UPLOAD_FAIL", {
      leadId,
      path: relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
