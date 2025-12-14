import type { SupabaseClient } from "../deps.ts";
import { sendText as sendTextMessage, sendList, sendButtons, sendTemplate } from "../wa/client.ts";
import { logStructuredEvent } from "../../observability/index.ts";
import { maskE164 } from "../utils/text.ts";
import type { ApprovedTemplate } from "../shared/template_registry.ts";

interface SendTextOptions {
  body: string;
  correlationId?: string;
  audit?: Record<string, unknown>;
}

export async function sendText(
  _supabase: SupabaseClient,
  to: string,
  opts: SendTextOptions,
): Promise<void> {
  await sendTextMessage(to, opts.body);
  await logStructuredEvent("WA_OUTBOUND_TEXT", {
    correlation_id: opts.correlationId ?? null,
    msisdn_masked: maskE164(to),
    preview: opts.body.slice(0, 120),
    ...sanitizeAudit(opts.audit),
  });
}

interface SendInteractiveListOptions {
  title: string;
  body: string;
  buttonText?: string;
  sectionTitle: string;
  rows: Array<{ id: string; title: string; description?: string }>;
  correlationId?: string;
}

export async function sendInteractiveList(
  _supabase: SupabaseClient,
  to: string,
  opts: SendInteractiveListOptions,
): Promise<void> {
  await sendList(to, {
    title: opts.title,
    body: opts.body,
    buttonText: opts.buttonText,
    sectionTitle: opts.sectionTitle,
    rows: opts.rows,
  });
  await logStructuredEvent("WA_OUTBOUND_LIST", {
    correlation_id: opts.correlationId ?? null,
    msisdn_masked: maskE164(to),
    title_preview: opts.title.slice(0, 60),
    row_count: opts.rows.length,
  });
}

interface SendInteractiveButtonsOptions {
  body: string;
  buttons: Array<{ id: string; title: string }>;
  correlationId?: string;
}

export async function sendInteractiveButtons(
  _supabase: SupabaseClient,
  to: string,
  opts: SendInteractiveButtonsOptions,
): Promise<void> {
  await sendButtons(to, opts.body, opts.buttons);
  await logStructuredEvent("WA_OUTBOUND_BUTTONS", {
    correlation_id: opts.correlationId ?? null,
    msisdn_masked: maskE164(to),
    button_count: opts.buttons.length,
  });
}

interface SendTemplateOptions {
  template: ApprovedTemplate;
  parameters: string[];
  correlationId?: string;
  preview?: string;
}

export async function sendTemplateMessage(
  _supabase: SupabaseClient,
  to: string,
  opts: SendTemplateOptions,
): Promise<{ success: boolean; reason?: string }> {
  try {
    await sendTemplate(to, {
      name: opts.template.templateName,
      language: opts.template.locale,
      templateId: opts.template.metaTemplateId ?? undefined,
      bodyParameters: opts.parameters.map((value) => ({
        type: "text" as const,
        text: value,
      })),
    });

    await logStructuredEvent("WA_OUTBOUND_TEMPLATE", {
      correlation_id: opts.correlationId ?? null,
      msisdn_masked: maskE164(to),
      template_key: opts.template.templateKey,
      template_locale: opts.template.locale,
      parameter_count: opts.parameters.length,
      preview: opts.preview?.slice(0, 120) ?? null,
    });

    return { success: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await logStructuredEvent("WA_OUTBOUND_TEMPLATE_ERROR", {
      correlation_id: opts.correlationId ?? null,
      msisdn_masked: maskE164(to),
      template_key: opts.template.templateKey,
      error: reason,
    });
    return { success: false, reason };
  }
}

function sanitizeAudit(audit?: Record<string, unknown>): Record<string, unknown> {
  if (!audit) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(audit)) {
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      result[key] = value;
    }
  }
  return result;
}
