import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
  withCors,
} from "../_shared/admin.ts";

const supabase = createServiceRoleClient();
const WA_TOKEN = Deno.env.get("WA_TOKEN") ?? "";

const requestSchema = z.object({
  media_id: z.string().min(10),
  subscription_id: z.number().int().positive(),
}).strict();

type DownloadedMedia = {
  buffer: Uint8Array;
  contentType: string;
};

async function fetchMedia(mediaId: string): Promise<DownloadedMedia> {
  const metaResp = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!metaResp.ok) {
    throw new Error(`metadata_fetch_failed:${metaResp.status}`);
  }
  const meta = await metaResp.json();
  const url = meta?.url;
  if (!url) throw new Error("media_url_missing");

  const mediaResp = await fetch(url, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!mediaResp.ok) {
    throw new Error(`media_download_failed:${mediaResp.status}`);
  }
  const buffer = new Uint8Array(await mediaResp.arrayBuffer());
  const contentType = mediaResp.headers.get("content-type") ??
    "application/octet-stream";
  return { buffer, contentType };
}

function pickExt(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("pdf")) return "pdf";
  return "bin";
}

Deno.serve(async (req) => {
  logRequest("media-fetch", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!WA_TOKEN) {
    await logStructuredEvent("ERROR", { data: "media-fetch.wa_token_missing" });
    return json({ error: "wa_token_missing" }, 500);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parseResult = requestSchema.safeParse(payload);
  if (!parseResult.success) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { media_id: mediaId, subscription_id: subscriptionId } =
    parseResult.data;

  try {
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("id,user_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (subscriptionError || !subscription) {
      throw new Error("subscription_not_found");
    }

    const media = await fetchMedia(mediaId);
    const ext = pickExt(media.contentType);
    const objectPath =
      `subscriptions/${subscription.user_id}/${subscriptionId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("proofs")
      .upload(objectPath, media.buffer, {
        contentType: media.contentType,
        upsert: true,
      });
    if (uploadError) {
      throw new Error("storage_upload_failed");
    }

    const { error: updateError } = await supabase.from("subscriptions")
      .update({ proof_url: objectPath, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId);
    if (updateError) {
      throw new Error("subscription_update_failed");
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("proofs")
      .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

    const responseBody = {
      ok: true,
      proof_url: objectPath,
      proof_url_signed: signedError ? null : signedData?.signedUrl ?? null,
    };

    if (signedError) {
      await logStructuredEvent("WARNING", { data: "media-fetch.signed_url_failed", signedError });
    }

    logResponse("media-fetch", 200, { subscriptionId });
    return new Response(
      JSON.stringify(responseBody),
      withCors({ status: 200 }),
    );
  } catch (error) {
    await logStructuredEvent("ERROR", { data: "media-fetch.unhandled", error });
    const message = error instanceof Error
      ? error.message
      : String(error ?? "error");
    const status = message === "subscription_not_found" ? 404 : 502;
    return json({ error: message }, status);
  }
});
