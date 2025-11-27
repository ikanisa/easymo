import type { RouterContext } from "../types.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import type { ChatState } from "../state/store.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { setState } from "../state/store.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { homeOnly, sendButtonsMessage } from "../utils/reply.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const TEMPLATE_PREFIX = "video_template::";

function parseTemplateSlug(rawId: string): string | null {
  if (!rawId.startsWith(TEMPLATE_PREFIX)) return null;
  const slug = rawId.slice(TEMPLATE_PREFIX.length).trim();
  if (!slug) return null;
  return slug;
}

function isWithinRightsWindow(
  start?: string | null,
  end?: string | null,
  now = new Date(),
): boolean {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (startDate && Number.isFinite(startDate.getTime()) && now < startDate) {
    return false;
  }
  if (endDate && Number.isFinite(endDate.getTime()) && now > endDate) {
    return false;
  }
  return true;
}

async function persistScript(
  ctx: RouterContext,
  payload: {
    templateId: string;
    templateSlug: string;
    synopsis: string | null;
    brandGuideId: string | null;
  },
) {
  if (!ctx.profileId) {
    throw new Error("video_agent.profile_missing");
  }
  const insertPayload = {
    template_id: payload.templateId,
    profile_id: ctx.profileId,
    whatsapp_msisdn: ctx.from,
    locale: ctx.locale,
    synopsis: payload.synopsis,
    metadata_json: {
      template_slug: payload.templateSlug,
      brand_guide_id: payload.brandGuideId,
      source: "whatsapp",
    },
    status: "pending_planning",
  } satisfies Record<string, unknown>;

  const { data, error } = await ctx.supabase
    .from("video_scripts")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`video_agent.script_insert_failed:${error.code ?? "unknown"}`);
  }
  return data as { id: string };
}

async function persistJob(
  ctx: RouterContext,
  scriptId: string,
  metadata: Record<string, unknown>,
) {
  const insertPayload = {
    script_id: scriptId,
    status: "queued",
    queue_status: "pending",
    whatsapp_status: "pending",
    provenance_json: metadata,
  } satisfies Record<string, unknown>;

  const { data, error } = await ctx.supabase
    .from("video_jobs")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`video_agent.job_insert_failed:${error.code ?? "unknown"}`);
  }
  return data as { id: string };
}

export async function handleVideoTemplateSelection(
  ctx: RouterContext,
  state: ChatState,
  listId: string,
): Promise<boolean> {
  const slug = parseTemplateSlug(listId);
  if (!slug) return false;

  const { data: template, error } = await ctx.supabase
    .from("video_templates")
    .select(
      "id, slug, title, description, rights_start, rights_end, brand_guide_id",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    await logStructuredEvent("ERROR", { data: "video_agent.template_lookup_failed", { error, slug } });
    await sendButtonsMessage(
      ctx,
      "⚠️ We couldn't load that video template. Please try again later.",
      homeOnly(),
    );
    return true;
  }

  if (!template) {
    await sendButtonsMessage(
      ctx,
      "That template is no longer available. Pick another option from the menu.",
      homeOnly(),
    );
    return true;
  }

  if (!isWithinRightsWindow(template.rights_start, template.rights_end)) {
    await sendButtonsMessage(
      ctx,
      "📽️ The rights window for that template has closed. Choose a different creative.",
      homeOnly(),
    );
    return true;
  }

  try {
    const script = await persistScript(ctx, {
      templateId: template.id,
      templateSlug: template.slug,
      synopsis: template.description ?? template.title ?? null,
      brandGuideId: template.brand_guide_id ?? null,
    });

    const job = await persistJob(ctx, script.id, {
      created_via: "whatsapp",
      template_slug: template.slug,
      template_title: template.title,
      previous_state: state?.key ?? null,
    });

    await setState(ctx.supabase, ctx.profileId!, {
      key: "video_job_created",
      data: { jobId: job.id },
    });

    await sendButtonsMessage(
      ctx,
      `🎬 Great choice! We're planning your ${template.title} video now. We'll message you once it's ready.`,
      homeOnly(),
    );
  } catch (persistError) {
    await logStructuredEvent("ERROR", { data: "video_agent.persist_failed", persistError });
    await sendButtonsMessage(
      ctx,
      "We hit a snag saving that request. Please try again or pick another template.",
      homeOnly(),
    );
  }

  return true;
}
