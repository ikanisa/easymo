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
    const media = await fetchWhatsAppMedia(mediaId);
    const extension = resolveExtension(media.mime, media.filename);
    await logStructuredEvent("INS_MEDIA_FETCH_OK", {
      leadId,
      mediaId,
      mime: media.mime,
      extension,
    });
    return { ...media, extension };
  } catch (error) {
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
    const { error } = await client.storage
      .from(INSURANCE_MEDIA_BUCKET)
      .upload(relativePath, file.bytes, {
        contentType: file.mime,
        upsert: false,
      });
    if (error) throw error;

    const { data: signed, error: signedError } = await client.storage
      .from(INSURANCE_MEDIA_BUCKET)
      .createSignedUrl(relativePath, 60, {
        transform: undefined,
      });
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error("signed_url_missing");
    }

    await logStructuredEvent("INS_UPLOAD_OK", {
      leadId,
      path: relativePath,
      size: file.bytes.length,
      mime: file.mime,
    });

    return { path: relativePath, signedUrl: signed.signedUrl };
  } catch (error) {
    await logStructuredEvent("INS_UPLOAD_FAIL", {
      leadId,
      path: relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
