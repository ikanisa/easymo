import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { queueNotification } from "../../notify/sender.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { recordAdminAudit } from "./audit.ts";
import {
  buildSampleComponents,
  describeVariables,
  findTemplateDefinition,
  getTemplateCatalog,
} from "./template_catalog.ts";
import {
  loadTemplateDetail,
  loadTemplateOverview,
  type TemplateMetrics,
  type TemplateRecentEvent,
} from "./template_metrics.ts";

type AdminContext = { waId: string };

type TemplateListOption = { id: string; title: string; subtitle?: string };

type TemplateDetailData = {
  name: string;
  label: string;
  summary: string;
  variables: string[];
  language: string;
  metrics: TemplateMetrics;
};

export async function handleAdminTemplates(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_templates_refresh":
    case "a_admin_open_templates":
      return await listTemplates(ctx.waId);
    case "a_admin_template_open":
      return await openTemplate(req, ctx);
    case "a_admin_template_send_test":
      return await sendTest(req, ctx);
    default:
      return await listTemplates(ctx.waId);
  }
}

async function listTemplates(adminWaId: string): Promise<FlowExchangeResponse> {
  const metrics = await loadTemplateOverview();
  const catalog = getTemplateCatalog();
  const knownNames = new Set<string>();
  const options: TemplateListOption[] = catalog.map((def) => {
    knownNames.add(def.name);
    return {
      id: def.name,
      title: def.label,
      subtitle: buildMetricsSubtitle(metrics.get(def.name)),
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
  options.sort((a, b) => a.title.localeCompare(b.title));
  await recordAdminAudit({ adminWaId, action: "admin_templates_list" });
  await logStructuredEvent("ADMIN_TEMPLATES_LIST", {
    count: options.length,
    wa_id: maskWa(adminWaId),
  });
  return {
    next_screen_id: "s_templates_list",
    data: {
      templates: options,
      summary_text: `Catalog: ${catalog.length} | Observed: ${metrics.size}`,
    },
  };
}

async function openTemplate(
  req: FlowExchangeRequest,
  ctx: AdminContext,
  messages?: FlowExchangeResponse["messages"],
): Promise<FlowExchangeResponse> {
  const template = extractTemplateField(req);
  if (!template) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Select a template first." }],
    };
  }
  const detail = await loadTemplateDetail(template);
  const def = findTemplateDefinition(template);
  const data: TemplateDetailData = {
    name: template,
    label: def?.label ?? template,
    summary: buildDetailSummary(def?.description, detail.metrics, template),
    variables: def?.variables ?? [],
    language: def?.language ?? "en",
    metrics: detail.metrics,
  };
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_template_view",
    targetId: template,
  });
  await logStructuredEvent("ADMIN_TEMPLATE_VIEW", {
    template,
    wa_id: maskWa(ctx.waId),
  });
  const recent = detail.recent.map(toRecentOption);
  const sample = buildSampleComponents(template);
  return {
    next_screen_id: "s_template_detail",
    data: {
      template: data,
      recent_notifications: recent,
      variables_text: data.variables.length
        ? data.variables.join(", ")
        : "No variables",
      sample_components_preview: sample.length
        ? JSON.stringify(sample, null, 2)
        : "[]",
      detail_summary_text: describeVariables(template),
    },
    messages,
  };
}

async function sendTest(
  req: FlowExchangeRequest,
  ctx: AdminContext,
): Promise<FlowExchangeResponse> {
  const template = extractTemplateField(req);
  if (!template) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Template required." }],
    };
  }
  const rawTo = typeof req.fields?.test_to === "string"
    ? req.fields.test_to.trim()
    : "";
  const target = rawTo ? normalizeWa(rawTo) : ctx.waId;
  if (!target) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Provide a WhatsApp number." }],
    };
  }
  const componentsJson = typeof req.fields?.components_json === "string"
    ? req.fields.components_json.trim()
    : "";
  let components: unknown[];
  if (componentsJson) {
    try {
      const parsed = JSON.parse(componentsJson);
      if (!Array.isArray(parsed)) {
        throw new Error("Components JSON must be an array.");
      }
      components = parsed;
    } catch (error) {
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "error",
          text: `Invalid components JSON: ${error}`,
        }],
      };
    }
  } else {
    components = buildSampleComponents(template);
  }
  const language = findTemplateDefinition(template)?.language ?? "en";
  await queueNotification(
    { to: target, template: { name: template, language, components } },
    { type: "admin_template_test" },
  );
  await recordAdminAudit({
    adminWaId: ctx.waId,
    action: "admin_template_test",
    targetId: template,
    after: { to: target },
  });
  await logStructuredEvent("ADMIN_TEMPLATE_TEST", {
    template,
    to: maskWa(target),
    wa_id: maskWa(ctx.waId),
  });
  const message = [{
    level: "info",
    text: `Test queued to ${maskWa(target)}.`,
  }];
  const nextReq: FlowExchangeRequest = {
    ...req,
    fields: { ...req.fields, template },
  };
  return await openTemplate(nextReq, ctx, message);
}

function extractTemplateField(req: FlowExchangeRequest): string | null {
  const value = req.fields?.template;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function buildMetricsSubtitle(metric?: TemplateMetrics): string | undefined {
  if (!metric) return undefined;
  return `Sent ${metric.sent} · Failed ${metric.failed} · Pending ${metric.queued}`;
}

function buildDetailSummary(
  description: string | undefined,
  metrics: TemplateMetrics,
  template: string,
): string {
  const parts = [description ?? `Template ${template}`];
  parts.push(`Sent: ${metrics.sent}`);
  parts.push(`Failed: ${metrics.failed}`);
  parts.push(`Queued: ${metrics.queued}`);
  if (metrics.lastStatusAt) {
    parts.push(
      `Last status: ${metrics.lastStatus ?? "?"} @ ${
        formatIso(metrics.lastStatusAt)
      }`,
    );
  }
  if (metrics.lastError) {
    parts.push(`Last error: ${metrics.lastError}`);
  }
  return parts.join(" | ");
}

function toRecentOption(event: TemplateRecentEvent) {
  return {
    id: event.id,
    title: `${event.status.toUpperCase()} · ${formatIso(event.created_at)}`,
    subtitle: buildRecentSubtitle(event),
  };
}

function buildRecentSubtitle(event: TemplateRecentEvent): string {
  const parts: string[] = [];
  if (event.to) parts.push(`to ${maskWa(event.to)}`);
  if (event.notification_type) parts.push(event.notification_type);
  if (event.sent_at) parts.push(`sent ${formatIso(event.sent_at)}`);
  if (event.error_message) parts.push(`error: ${event.error_message}`);
  if (parts.length === 0) parts.push("No delivery metadata.");
  return parts.join(" | ");
}

function formatIso(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").replace("Z", " UTC");
}

function normalizeWa(wa: string): string {
  const trimmed = wa.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^\+/, "")}`;
}

function maskWa(wa: string): string {
  const normalized = normalizeWa(wa);
  if (!normalized) return "-";
  return `***${normalized.slice(-4)}`;
}
