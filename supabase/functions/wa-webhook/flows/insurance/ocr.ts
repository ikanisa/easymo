import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { fetchWhatsAppMedia } from "../../utils/media.ts";
import { queueNotification } from "../../notify/sender.ts";
import { getAppConfig } from "../../utils/app_config.ts";
import { logOcrStatus } from "../../observe/log.ts";
import { INSURANCE_MEDIA_BUCKET } from "../../config.ts";

export async function startInsurance(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  await sendText(
    ctx.from,
    "Send a photo or PDF of the insurance certificate to continue.",
  );
  return true;
}

export async function handleInsuranceMedia(
  ctx: RouterContext,
  msg: any,
): Promise<boolean> {
  const mediaId: string | undefined = msg?.document?.id ?? msg?.image?.id;
  if (!mediaId) return false;
  try {
    const caption = msg?.document?.filename ?? msg?.image?.caption ??
      msg?.document?.caption ?? "";
    const media = await fetchWhatsAppMedia(mediaId);
    const storagePath = await uploadInsuranceMedia(
      ctx,
      media.bytes,
      media.mime,
      media.filename,
    );
    await queueInsuranceIngestion(ctx, {
      storagePath,
      mime: media.mime,
      caption,
    });
    await alertInsuranceAdmins(ctx, { storagePath, caption });
    await logOcrStatus({ wa_id: ctx.from, storage_path: storagePath, caption });
    await sendText(
      ctx.from,
      "Thanks! Our team will review and follow up shortly.",
    );
  } catch (error) {
    console.error("insurance.ocr_upload_fail", error);
    await sendText(
      ctx.from,
      "Upload failed. Please resend a clearer image or try again later.",
    );
  }
  return true;
}

async function uploadInsuranceMedia(
  ctx: RouterContext,
  bytes: Uint8Array,
  mime: string,
  filename?: string,
): Promise<string> {
  const name = filename?.replace(/[^A-Za-z0-9._-]/g, "") || "insurance-doc";
  const path = `${ctx.profileId ?? "anon"}/${crypto.randomUUID()}-${name}`;
  const { error } = await ctx.supabase.storage.from(INSURANCE_MEDIA_BUCKET)
    .upload(path, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: mime || "application/octet-stream",
    });
  if (error) {
    throw error;
  }
  return path;
}

async function queueInsuranceIngestion(
  ctx: RouterContext,
  params: { storagePath: string; mime: string; caption: string },
): Promise<void> {
  try {
    await ctx.supabase.rpc("insurance_queue_media", {
      _profile_id: ctx.profileId ?? null,
      _wa_id: ctx.from,
      _storage_path: params.storagePath,
      _mime_type: params.mime,
      _caption: params.caption,
    });
  } catch (error) {
    console.error("insurance.queue_fail", error);
  }
}

async function alertInsuranceAdmins(
  ctx: RouterContext,
  params: { storagePath: string; caption: string },
): Promise<void> {
  try {
    const config = await getAppConfig(ctx.supabase);
    const admins = config.insurance_admin_numbers ?? [];
    if (!admins?.length) return;
    const message =
      `Insurance upload from ${ctx.from}\nFile: ${params.storagePath}${
        params.caption ? `\nNote: ${params.caption}` : ""
      }`;
    await Promise.allSettled(
      admins.slice(0, 5).map((to) =>
        queueNotification({ to, text: message }, { type: "insurance_upload" })
      ),
    );
  } catch (error) {
    console.error("insurance.alert_fail", error);
  }
}
