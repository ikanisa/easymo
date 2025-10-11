import { supabase } from "../../config.ts";

type NotificationRow = {
  id: string;
  template_name: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  to_wa_id?: string | null;
  notification_type?: string | null;
};

export type TemplateMetrics = {
  name: string;
  sent: number;
  failed: number;
  queued: number;
  lastStatus?: string;
  lastStatusAt?: string | null;
  lastError?: string | null;
};

export type TemplateRecentEvent = {
  id: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  to: string | null;
  error_message: string | null;
  notification_type: string | null;
};

export async function loadTemplateOverview(
  limit = 200,
): Promise<Map<string, TemplateMetrics>> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, template_name, status, created_at, sent_at, error_message")
    .eq("channel", "template")
    .not("template_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const metrics = new Map<string, TemplateMetrics>();
  for (const row of (data ?? []) as NotificationRow[]) {
    if (!row.template_name) continue;
    const current = metrics.get(row.template_name) ??
      createEmptyMetrics(row.template_name);
    applyRowToMetrics(current, row);
    metrics.set(row.template_name, current);
  }
  return metrics;
}

export async function loadTemplateDetail(
  name: string,
  limit = 20,
): Promise<{ metrics: TemplateMetrics; recent: TemplateRecentEvent[] }> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, template_name, status, created_at, sent_at, error_message, to_wa_id, notification_type",
    )
    .eq("channel", "template")
    .eq("template_name", name)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const metrics = createEmptyMetrics(name);
  const recent: TemplateRecentEvent[] = [];
  for (const row of (data ?? []) as NotificationRow[]) {
    applyRowToMetrics(metrics, row);
    recent.push({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      sent_at: row.sent_at ?? null,
      to: row.to_wa_id ?? null,
      error_message: row.error_message ?? null,
      notification_type: row.notification_type ?? null,
    });
  }
  return { metrics, recent };
}

function createEmptyMetrics(name: string): TemplateMetrics {
  return { name, sent: 0, failed: 0, queued: 0 };
}

function applyRowToMetrics(metrics: TemplateMetrics, row: NotificationRow) {
  switch (row.status) {
    case "sent":
      metrics.sent += 1;
      break;
    case "failed":
      metrics.failed += 1;
      break;
    default:
      metrics.queued += 1;
      break;
  }
  const occurredAt = row.sent_at ?? row.created_at;
  if (
    !metrics.lastStatusAt ||
    new Date(occurredAt).getTime() >= new Date(metrics.lastStatusAt).getTime()
  ) {
    metrics.lastStatusAt = occurredAt;
    metrics.lastStatus = row.status;
    metrics.lastError = row.error_message ?? null;
  }
}
