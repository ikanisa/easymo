import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { queueNotification } from "../../notify/sender.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { recordAdminAudit } from "./audit.ts";
import {
  describeVariables,
  findTemplateDefinition,
  getTemplateCatalog,
} from "./template_catalog.ts";
import {
  loadTemplateOverview,
  type TemplateMetrics,
} from "./template_metrics.ts";

type AdminContext = { waId: string };

type BroadcastPreview = {
  template: string;
  template_label: string;
  audience: string;
  estimate: number;
  reason?: string;
  components_preview: string;
};

type BroadcastExtras = {
  selectedTemplate?: string;
  preview?: BroadcastPreview;
  messages?: FlowExchangeResponse["messages"];
};

type TemplateOption = { id: string; title: string; subtitle?: string };

type BroadcastParams = {
  template: string;
  audience: string;
  reason: string;
  components: unknown[];
  language: string;
  componentsSource: "components_json" | "reason" | "empty";
};

export async function handleAdminBroadcast(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_broadcast_open":
    case "a_admin_broadcast_refresh":
      await recordAdminAudit({
        adminWaId: ctx.waId,
        action: "admin_broadcast_open",
      });
      await logStructuredEvent("ADMIN_BROADCAST_OPEN", {
        wa_id: maskWa(ctx.waId),
      });
      return await loadBroadcastScreen(req, ctx);
    case "a_admin_broadcast_template":
      return await describeTemplate(req, ctx);
    case "a_admin_broadcast_preview":
      return await previewBroadcast(req, ctx);
    case "a_admin_broadcast_audience":
      return await estimateAudience(req, ctx);
    case "a_admin_broadcast_dryrun":
      return await dryRun(req, ctx);
    case "a_admin_broadcast_send":
      return await sendBroadcast(req, ctx);
    default:
      return await loadBroadcastScreen(req, ctx);
  }
}

async function loadBroadcastScreen(
  req: FlowExchangeRequest,
  ctx: AdminContext,
  extras: BroadcastExtras = {},
): Promise<FlowExchangeResponse> {
  const metrics = await loadTemplateOverview();
  const options = await resolveTemplateOptions(metrics);
  const selectedName = extras.selectedTemplate ?? extractTemplateField(req) ??
    options[0]?.id ?? null;
  const selectedTemplate = selectedName
    ? buildTemplateSummary(selectedName, metrics)
    : buildPlaceholderSummary();
  const data: Record<string, unknown> = {
    template_options: options,
    selected_template: selectedTemplate,
    preview_summary: extras.preview
      ? `${extras.preview.template_label} → ${extras.preview.estimate} recipients`
      : "",
    preview_components: extras.preview?.components_preview ?? "",
  };
  return {
    next_screen_id: "s_broadcast",
    data,
    messages: extras.messages,
  };
}

async function describeTemplate(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  const template = extractTemplateField(req);
  if (!template) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Select a template first." }],
    };
  }
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_broadcast_template_select",
    after: { template },
  });
  await logStructuredEvent("ADMIN_BROADCAST_TEMPLATE", {
    template,
    wa_id: maskWa(ctx.waId),
  });
  const metrics = await loadTemplateOverview();
  const summary = buildTemplateSummary(template, metrics);
  const descriptionLines = [summary.summary, describeVariables(template)];
  const messages = [{ level: "info", text: descriptionLines.join("\n") }];
  return await loadBroadcastScreen(req, ctx, {
    selectedTemplate: template,
    messages,
  });
}

async function previewBroadcast(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  let params: BroadcastParams;
  try {
    params = parseBroadcastFields(req);
  } catch (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: String(error) }],
    };
  }
  const estimate = await countAudience(params.audience);
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_broadcast_preview",
    after: { template: params.template, audience: params.audience, estimate },
  });
  await logStructuredEvent("ADMIN_BROADCAST_PREVIEW", {
    template: params.template,
    audience: params.audience,
    estimate,
    wa_id: maskWa(ctx.waId),
  });
  const preview = buildPreviewData(params, estimate);
  const messages = [{
    level: "info",
    text: `Estimated recipients: ${estimate}`,
  }];
  return await loadBroadcastScreen(req, ctx, {
    selectedTemplate: params.template,
    preview,
    messages,
  });
}

async function estimateAudience(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  const template = extractTemplateField(req);
  const audience = String(req.fields?.audience ?? "all_opted_in");
  const estimate = await countAudience(audience);
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_broadcast_audience",
    after: { template, audience, estimate },
  });
  await logStructuredEvent("ADMIN_BROADCAST_AUDIENCE", {
    audience,
    estimate,
    wa_id: maskWa(ctx.waId),
  });
  const messages = [{ level: "info", text: `Audience size ~${estimate}.` }];
  return await loadBroadcastScreen(req, ctx, {
    selectedTemplate: template ?? undefined,
    messages,
  });
}

async function dryRun(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  let params: BroadcastParams;
  try {
    params = parseBroadcastFields(req);
  } catch (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: String(error) }],
    };
  }
  await queueNotification(
    {
      to: ctx.waId,
      template: {
        name: params.template,
        language: params.language,
        components: params.components,
      },
    },
    { type: "admin_broadcast_dryrun" },
  );
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_broadcast_dryrun",
    after: {
      template: params.template,
      audience: params.audience,
      components_source: params.componentsSource,
    },
  });
  await logStructuredEvent("ADMIN_BROADCAST_DRYRUN", {
    template: params.template,
    audience: params.audience,
    wa_id: maskWa(ctx.waId),
  });
  const preview = buildPreviewData(params, 1);
  const messages = [{ level: "info", text: "Dry run queued to your number." }];
  return await loadBroadcastScreen(req, ctx, {
    selectedTemplate: params.template,
    preview,
    messages,
  });
}

async function sendBroadcast(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  let params: BroadcastParams;
  try {
    params = parseBroadcastFields(req);
  } catch (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: String(error) }],
    };
  }
  const recipients = await resolveAudience(params.audience);
  if (recipients.length === 0) {
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "warning",
        text: "Audience returned no recipients.",
      }],
    };
  }
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_broadcast_send",
    after: {
      template: params.template,
      audience: params.audience,
      count: recipients.length,
      components_source: params.componentsSource,
    },
  });
  await logStructuredEvent("ADMIN_BROADCAST_SEND", {
    template: params.template,
    audience: params.audience,
    count: recipients.length,
  });
  await Promise.allSettled(
    recipients.map((to) =>
      queueNotification(
        {
          to,
          template: {
            name: params.template,
            language: params.language,
            components: params.components,
          },
        },
        { type: "admin_broadcast", scheduleSeconds: 0 },
      )
    ),
  );
  const preview = buildPreviewData(params, recipients.length);
  const messages = [{
    level: "info",
    text: `Broadcast queued (${recipients.length} recipients).`,
  }];
  return await loadBroadcastScreen(req, ctx, {
    selectedTemplate: params.template,
    preview,
    messages,
  });
}

function parseBroadcastFields(req: FlowExchangeRequest): BroadcastParams {
  const template = String(req.fields?.template ?? "").trim();
  const audience = String(req.fields?.audience ?? "all_opted_in");
  const reason = String(req.fields?.reason ?? "").trim();
  if (!template) {
    throw new Error("Template required.");
  }
  const componentsJson = String(req.fields?.components_json ?? "").trim();
  let components: unknown[] = [];
  let source: BroadcastParams["componentsSource"] = "empty";
  if (componentsJson) {
    try {
      const parsed = JSON.parse(componentsJson);
      if (!Array.isArray(parsed)) {
        throw new Error("Components JSON must be an array.");
      }
      components = parsed;
      source = "components_json";
    } catch (error) {
      throw new Error(`Invalid components JSON: ${error}`);
    }
  } else if (reason) {
    components = [{
      type: "body",
      parameters: [{ type: "text", text: reason }],
    }];
    source = "reason";
  }
  const language = findTemplateDefinition(template)?.language ?? "en";
  return {
    template,
    audience,
    reason,
    components,
    language,
    componentsSource: source,
  };
}

async function resolveTemplateOptions(
  metrics: Map<string, TemplateMetrics>,
): Promise<TemplateOption[]> {
  const catalog = getTemplateCatalog();
  const knownNames = new Set<string>();
  const options: TemplateOption[] = catalog.map((entry) => {
    knownNames.add(entry.name);
    return {
      id: entry.name,
      title: entry.label,
      subtitle: buildMetricsSubtitle(metrics.get(entry.name)),
    };
  });
  for (const metric of metrics.values()) {
    if (knownNames.has(metric.name)) continue;
    options.push({
      id: metric.name,
      title: metric.name,
      subtitle: buildMetricsSubtitle(metric),
    });
  }
  if (options.length === 0) {
    options.push({
      id: "",
      title: "No templates found",
      subtitle: "Configure templates in Meta",
    });
  }
  return options;
}

function buildTemplateSummary(
  name: string,
  metrics: Map<string, TemplateMetrics>,
) {
  const def = findTemplateDefinition(name);
  const metric = metrics.get(name) ?? { name, sent: 0, failed: 0, queued: 0 };
  const parts = [
    def?.description ?? "No catalog metadata available.",
    buildMetricsSummary(metric),
    describeVariables(name),
  ];
  return {
    name,
    label: def?.label ?? name,
    summary: parts.filter(Boolean).join("\n"),
    metrics: metric,
    language: def?.language ?? "en",
    variables: def?.variables ?? [],
  };
}

function buildPlaceholderSummary() {
  return {
    name: "",
    label: "Select a template",
    summary: "Choose a template and tap Describe to load metadata.",
    metrics: { name: "", sent: 0, failed: 0, queued: 0 },
    language: "en",
    variables: [] as string[],
  };
}

function buildMetricsSubtitle(metric?: TemplateMetrics): string | undefined {
  if (!metric) return undefined;
  return `Sent ${metric.sent} · Failed ${metric.failed} · Pending ${metric.queued}`;
}

function buildMetricsSummary(metric: TemplateMetrics): string {
  const last = metric.lastStatusAt
    ? `Last: ${metric.lastStatus} @ ${metric.lastStatusAt}`
    : "No history yet.";
  const error = metric.lastError ? `Last error: ${metric.lastError}` : "";
  return [
    `Sent: ${metric.sent}`,
    `Failed: ${metric.failed}`,
    `Queued: ${metric.queued}`,
    last,
    error,
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildPreviewData(
  params: BroadcastParams,
  estimate: number,
): BroadcastPreview {
  const def = findTemplateDefinition(params.template);
  return {
    template: params.template,
    template_label: def?.label ?? params.template,
    audience: params.audience,
    estimate,
    reason: params.reason || undefined,
    components_preview: params.components.length
      ? JSON.stringify(params.components, null, 2)
      : "[]",
  };
}

function extractTemplateField(req: FlowExchangeRequest): string | null {
  const value = req.fields?.template;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function countAudience(audience: string): Promise<number> {
  switch (audience) {
    case "recent_30d":
      return await contactsCountWhere(
        "last_inbound_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      );
    case "top_promoters":
      return (await topPromoters()).length;
    case "all_opted_in":
    default:
      return await contactsCountWhere();
  }
}

async function contactsCountWhere(
  field?: string,
  since?: Date,
): Promise<number> {
  let query = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("opted_out", false);
  if (field && since) {
    query = query.gte(field, since.toISOString());
  }
  const { error, count } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function resolveAudience(audience: string): Promise<string[]> {
  switch (audience) {
    case "recent_30d":
      return await contactsWhere(
        "last_inbound_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      );
    case "top_promoters":
      return await topPromoters();
    case "all_opted_in":
    default:
      return await contactsWhere();
  }
}

async function contactsWhere(field?: string, since?: Date): Promise<string[]> {
  let query = supabase
    .from("contacts")
    .select("msisdn_e164")
    .eq("opted_out", false)
    .limit(2000);
  if (field && since) {
    query = query.gte(field, since.toISOString());
  }
  const { data, error } = await query;
  if (error) throw error;
  return dedupe(
    (data ?? []).map((row: { msisdn_e164: string | null }) => row.msisdn_e164)
      .filter(Boolean) as string[],
  );
}

async function topPromoters(): Promise<string[]> {
  const { data, error } = await supabase
    .from("wallet_promoters")
    .select("whatsapp")
    .order("tokens", { ascending: false })
    .limit(9);
  if (error) throw error;
  return dedupe(
    (data ?? []).map((row: { whatsapp: string | null }) => row.whatsapp).filter(
      Boolean,
    ) as string[],
  );
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const v = normalizeWa(value);
    if (!seen.has(v)) {
      seen.add(v);
      normalized.push(v);
    }
  }
  return normalized;
}

function normalizeWa(wa: string): string {
  const trimmed = wa.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^\+/, "")}`;
}

function maskWa(wa: string): string {
  const normalized = normalizeWa(wa);
  return `***${normalized.slice(-4)}`;
}
