import { getSupabaseAdminClient } from "./supabase-admin";

export interface ShotPlanShot {
  order: number;
  duration_seconds: number;
  prompt: string;
  voiceover: string;
  reference_product_id?: string | null;
  overlays?: Record<string, unknown> | null;
}

export interface ShotPlanReferences {
  products?: Array<{
    id: string;
    name?: string;
    description?: string | null;
    keywords?: string[];
    hero_asset_url?: string | null;
  }>;
  brand_guides?: Array<{
    id: string;
    title?: string;
    summary?: string | null;
  }>;
}

export interface ShotPlan {
  version?: string;
  locale?: string;
  template?: string;
  synopsis?: string | null;
  voice?: string;
  references?: ShotPlanReferences;
  shots?: ShotPlanShot[];
}

export interface VideoJobDetail {
  id: string;
  status: string;
  queueStatus: string;
  whatsappStatus: string;
  masterPath: string | null;
  masterSignedUrl: string | null;
  whatsappPath: string | null;
  whatsappSignedUrl: string | null;
  shotplan: ShotPlan | null;
  provenance: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  script: {
    locale: string | null;
    synopsis: string | null;
    templateSlug: string | null;
    templateTitle: string | null;
  } | null;
}

function coerceRecord(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return null;
}

function coerceShotPlan(input: unknown): ShotPlan | null {
  const record = coerceRecord(input);
  if (!record) return null;
  if (record.shots && !Array.isArray(record.shots)) return null;
  return record as ShotPlan;
}

export async function loadVideoJobDetail(jobId: string): Promise<VideoJobDetail | null> {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin client is not configured");
  }

  const { data, error } = await client
    .from("video_jobs")
    .select(
      `
        id,
        status,
        queue_status,
        whatsapp_status,
        master_path,
        whatsapp_path,
        shotplan_json,
        provenance_json,
        created_at,
        updated_at,
        script:video_scripts!video_jobs_script_id_fkey (
          locale,
          synopsis,
          metadata_json,
          template:video_templates!video_scripts_template_id_fkey (
            slug,
            title
          )
        )
      `,
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const masterPath = data.master_path as string | null;
  const whatsappPath = data.whatsapp_path as string | null;

  let masterSignedUrl: string | null = null;
  let whatsappSignedUrl: string | null = null;

  if (masterPath) {
    const { data: signed, error: signedError } = await client.storage
      .from("masters")
      .createSignedUrl(masterPath, 60 * 10);
    if (!signedError) {
      masterSignedUrl = signed?.signedUrl ?? null;
    }
  }

  if (whatsappPath) {
    const { data: signed, error: signedError } = await client.storage
      .from("masters")
      .createSignedUrl(whatsappPath, 60 * 10);
    if (!signedError) {
      whatsappSignedUrl = signed?.signedUrl ?? null;
    }
  }

  const script = data.script as
    | {
      locale: string | null;
      synopsis: string | null;
      template?: { slug?: string | null; title?: string | null } | null;
    }
    | null
    | undefined;

  return {
    id: data.id as string,
    status: data.status as string,
    queueStatus: data.queue_status as string,
    whatsappStatus: data.whatsapp_status as string,
    masterPath,
    masterSignedUrl,
    whatsappPath,
    whatsappSignedUrl,
    shotplan: coerceShotPlan(data.shotplan_json),
    provenance: coerceRecord(data.provenance_json),
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    script: script
      ? {
        locale: script.locale ?? null,
        synopsis: script.synopsis ?? null,
        templateSlug: script.template?.slug ?? null,
        templateTitle: script.template?.title ?? null,
      }
      : null,
  } satisfies VideoJobDetail;
}
