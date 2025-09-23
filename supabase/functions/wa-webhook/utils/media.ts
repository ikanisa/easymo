import { WA_TOKEN } from "../config.ts";

export async function fetchWhatsAppMedia(metaId: string): Promise<{ bytes: Uint8Array; mime: string; filename?: string }> {
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${metaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!metaRes.ok) {
    throw new Error(`media_meta_fail ${metaRes.status}`);
  }
  const meta = await metaRes.json();
  const downloadRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!downloadRes.ok) {
    throw new Error(`media_download_fail ${downloadRes.status}`);
  }
  const arrayBuffer = await downloadRes.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    mime: meta.mime_type ?? "application/octet-stream",
    filename: meta.file_name,
  };
}
