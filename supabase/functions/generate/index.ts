import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { requireEnv } from "../_shared/env.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { badRequest, json, methodNotAllowed, notFound, serverError } from "../_shared/http.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { buildWhatsappPreset } from "../../../tools/ffmpeg-presets/whatsapp.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const requestSchema = z.object({
  job_id: z.string().uuid(),
});

const MAX_WHATSAPP_BYTES = 16 * 1024 * 1024;

type SoraConfig = { url: string; key: string };

function getSoraConfig(): SoraConfig {
  return {
    url: requireEnv("SORA_API_URL"),
    key: requireEnv("SORA_API_KEY"),
  };
}

async function callSora(
  payload: Record<string, unknown>,
  config: SoraConfig,
): Promise<{ id: string; video_url: string }> {
  const response = await fetch(`${config.url.replace(/\/$/, "")}/v1/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`sora_request_failed:${response.status}:${text}`);
  }

  const body = await response.json();
  const id = body?.id ?? body?.data?.id;
  const videoUrl = body?.video_url ?? body?.result?.video_url ?? body?.data?.video_url;
  if (!id || !videoUrl) {
    throw new Error("sora_response_missing_video");
  }
  return { id, video_url: videoUrl };
}

async function downloadBinary(url: string, config: SoraConfig): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: config.key ? { authorization: `Bearer ${config.key}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`video_download_failed:${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function transcodeWhatsappVariant(master: Uint8Array): Promise<Uint8Array> {
  const inputFile = await Deno.makeTempFile({ suffix: ".mp4" });
  const outputFile = await Deno.makeTempFile({ suffix: ".mp4" });
  try {
    await Deno.writeFile(inputFile, master);
    const primaryArgs = buildWhatsappPreset(inputFile, outputFile, {
      maxVideoKbps: 1100,
      audioKbps: 96,
      maxWidth: 720,
    });
    let result = await new Deno.Command("ffmpeg", { args: primaryArgs }).output();
    if (!result.success) {
      throw new Error(`ffmpeg_failed:${result.code ?? 1}`);
    }
    let rendition = await Deno.readFile(outputFile);
    if (rendition.byteLength > MAX_WHATSAPP_BYTES) {
      const fallbackArgs = buildWhatsappPreset(inputFile, outputFile, {
        maxVideoKbps: 750,
        audioKbps: 64,
        maxWidth: 640,
      });
      result = await new Deno.Command("ffmpeg", { args: fallbackArgs }).output();
      if (!result.success) {
        throw new Error(`ffmpeg_fallback_failed:${result.code ?? 1}`);
      }
      rendition = await Deno.readFile(outputFile);
      if (rendition.byteLength > MAX_WHATSAPP_BYTES) {
        throw new Error("whatsapp_rendition_too_large");
      }
    }
    return rendition;
  } finally {
    await Promise.all([
      Deno.remove(inputFile).catch(() => {}),
      Deno.remove(outputFile).catch(() => {}),
    ]);
  }
}

function mergeProvenance(
  existing: unknown,
  update: Record<string, unknown>,
): Record<string, unknown> {
  const base = (existing && typeof existing === "object") ? existing as Record<string, unknown> : {};
  return { ...base, ...update };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest("invalid_payload", { issues: parsed.error.flatten() });
  }

  const client = getServiceClient();
  const jobId = parsed.data.job_id;

  const { data: job, error: jobError } = await client
    .from("video_jobs")
    .select(
      "id, script_id, status, shotplan_json, provenance_json, script:video_scripts!video_jobs_script_id_fkey (locale, synopsis, template:video_templates!video_scripts_template_id_fkey (slug))",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    await logStructuredEvent("ERROR", { data: "generate.job_lookup_failed", jobError });
    return serverError("job_lookup_failed");
  }

  if (!job) {
    return notFound("video_job_not_found");
  }

  if (!job.shotplan_json) {
    return badRequest("shotplan_missing");
  }

  const soraConfig = getSoraConfig();

  try {
    const sora = await callSora({
      kind: "video",
      job_id: job.id,
      shotplan: job.shotplan_json,
      metadata: {
        source: "supabase_generate_edge",
        locale: job.script?.locale ?? "unknown",
      },
    }, soraConfig);

    const masterBuffer = await downloadBinary(sora.video_url, soraConfig);
    const masterPath = `video/${job.script_id}/${job.id}/master.mp4`;
    const whatsappPath = `video/${job.script_id}/${job.id}/whatsapp.mp4`;

    const { error: storageError } = await client.storage
      .from("masters")
      .upload(masterPath, masterBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (storageError) {
      throw new Error(`master_upload_failed:${storageError.message}`);
    }

    const whatsappBuffer = await transcodeWhatsappVariant(masterBuffer);
    const { error: whatsappUploadError } = await client.storage
      .from("masters")
      .upload(whatsappPath, whatsappBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (whatsappUploadError) {
      throw new Error(`whatsapp_upload_failed:${whatsappUploadError.message}`);
    }

    const provenance = mergeProvenance(job.provenance_json, {
      generator: {
        completed_at: new Date().toISOString(),
        sora_job_id: sora.id,
        master_bytes: masterBuffer.byteLength,
        whatsapp_bytes: whatsappBuffer.byteLength,
      },
    });

    const { error: updateError } = await client
      .from("video_jobs")
      .update({
        status: "rendered",
        queue_status: "complete",
        whatsapp_status: "ready",
        sora_request_id: sora.id,
        master_path: masterPath,
        whatsapp_path: whatsappPath,
        provenance_json: provenance,
      })
      .eq("id", job.id);

    if (updateError) {
      throw new Error(`job_update_failed:${updateError.message}`);
    }

    return json({
      ok: true,
      job_id: job.id,
      master_path: masterPath,
      whatsapp_path: whatsappPath,
      sora_job_id: sora.id,
    });
  } catch (error) {
    await logStructuredEvent("ERROR", { data: "generate.unhandled", error });
    return serverError("generation_failed", {
      message: error instanceof Error ? error.message : String(error ?? "error"),
    });
  }
});
