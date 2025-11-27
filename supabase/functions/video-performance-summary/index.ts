import { z } from "zod";
import { logStructuredEvent } from "../_shared/observability.ts";
import {
import { logStructuredEvent } from "../_shared/observability.ts";
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  parseNumber,
  requireAdminAuth,
} from "../_shared/admin.ts";
import { queueNotification } from "../wa-webhook/notify/sender.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createServiceRoleClient();

type SummaryPeriod = "daily" | "weekly";

const DEFAULT_PERIODS: SummaryPeriod[] = ["daily", "weekly"];
const DEFAULT_LIMIT = parseNumber(Deno.env.get("VIDEO_PERFORMANCE_TOP_LIMIT"), 5);
const DEFAULT_DAILY_LOOKBACK = parseNumber(
  Deno.env.get("VIDEO_PERFORMANCE_DAILY_LOOKBACK_DAYS"),
  2,
);
const DEFAULT_WEEKLY_LOOKBACK = parseNumber(
  Deno.env.get("VIDEO_PERFORMANCE_WEEKLY_LOOKBACK_DAYS"),
  14,
);

const CRON_ENABLED = (Deno.env.get("VIDEO_PERFORMANCE_SUMMARY_CRON_ENABLED") ?? "true")
  .toLowerCase() === "true";
const DAILY_CRON = Deno.env.get("VIDEO_PERFORMANCE_SUMMARY_DAILY_CRON")
  ?? "5 7 * * *"; // 07:05 UTC daily
const WEEKLY_CRON = Deno.env.get("VIDEO_PERFORMANCE_SUMMARY_WEEKLY_CRON")
  ?? "10 7 * * MON"; // Mondays 07:10 UTC

const denoWithCron = Deno as typeof Deno & {
  cron?: (
    name: string,
    schedule: string,
    handler: () => void | Promise<void>,
  ) => void;
};

type PerformanceRow = {
  job_id: string;
  slot: string;
  hook_label: string | null;
  cta_variant: string | null;
  interval: SummaryPeriod | "lifetime";
  interval_start: string;
  renders: number | null;
  approvals: number | null;
  whatsapp_clicks: number | null;
  approval_rate: number | null;
  click_through_rate: number | null;
  cost_per_render: number | null;
  insights: string | null;
  metadata: Record<string, unknown> | null;
  job: {
    id: string;
    campaign_id: string | null;
    template_label: string | null;
    hook_label: string | null;
    cta_variant: string | null;
    script_version: string | null;
    rights_expiry_at: string | null;
    render_currency: string | null;
  } | null;
};

type Highlight = {
  jobId: string;
  slot: string;
  hookLabel: string;
  templateLabel: string;
  scriptVersion: string | null;
  approvals: number;
  renders: number;
  approvalRate: number;
  clickThroughRate: number;
  costPerRender: number | null;
  score: number;
  ctaVariant: string | null;
  intervalStart: string;
  rightsExpiryAt: string | null;
  renderCurrency: string | null;
};

type RightsExpiry = {
  jobId: string;
  slot: string;
  hookLabel: string;
  scriptVersion: string | null;
  rightsExpiryAt: string;
  daysRemaining: number;
};

type SummaryResult = {
  period: SummaryPeriod;
  lookbackDays: number;
  lookbackStart: string;
  highlights: Highlight[];
  rightsExpiring: RightsExpiry[];
  message: string;
  recipients: string[];
  deliveries: Array<{
    to: string;
    queued: boolean;
    notificationId?: string;
    error?: string;
  }>;
};

const requestSchema = z.object({
  periods: z.array(z.enum(["daily", "weekly"]) as const).optional(),
  dryRun: z.boolean().optional(),
  recipients: z.array(z.string().min(3)).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  lookbackDays: z.coerce.number().int().min(1).max(60).optional(),
});

Deno.serve(async (req) => {
  logRequest("video-performance-summary", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const parseResult = requestSchema.safeParse(payload);
  if (!parseResult.success) {
    return json({ error: "invalid_payload", details: parseResult.error.flatten() }, 400);
  }

  const input = parseResult.data;
  const periods = (input.periods?.length ? input.periods : DEFAULT_PERIODS) as SummaryPeriod[];
  const limit = input.limit ?? DEFAULT_LIMIT;
  const sharedLookback = input.lookbackDays ?? null;
  const dryRun = input.dryRun ?? false;
  const recipientsOverride = input.recipients?.map((value) => value.trim()).filter(Boolean) ?? null;

  const reports: SummaryResult[] = [];
  for (const period of periods) {
    const lookbackDays = sharedLookback ?? (period === "daily" ? DEFAULT_DAILY_LOOKBACK : DEFAULT_WEEKLY_LOOKBACK);
    const report = await runSummary(period, {
      limit,
      lookbackDays,
      dryRun,
      recipientsOverride,
      trigger: "http",
    });
    reports.push(report);
  }

  logResponse("video-performance-summary", 200, {
    periods: reports.map((report) => report.period),
    dryRun,
  });

  return json({ ok: true, reports });
});

if (typeof denoWithCron.cron === "function" && CRON_ENABLED) {
  denoWithCron.cron("video-performance-summary-daily", DAILY_CRON, async () => {
    await runSummary("daily", {
      limit: DEFAULT_LIMIT,
      lookbackDays: DEFAULT_DAILY_LOOKBACK,
      trigger: "cron",
    }).catch((error) => {
      await logStructuredEvent("ERROR", { data: "video-performance-summary.daily_cron_failed", error });
    });
  });

  denoWithCron.cron("video-performance-summary-weekly", WEEKLY_CRON, async () => {
    await runSummary("weekly", {
      limit: DEFAULT_LIMIT,
      lookbackDays: DEFAULT_WEEKLY_LOOKBACK,
      trigger: "cron",
    }).catch((error) => {
      await logStructuredEvent("ERROR", { data: "video-performance-summary.weekly_cron_failed", error });
    });
  });
} else if (CRON_ENABLED) {
  await logStructuredEvent("WARNING", { data: "video-performance-summary.cron_unavailable" });
}

type RunSummaryOptions = {
  limit: number;
  lookbackDays: number;
  dryRun?: boolean;
  recipientsOverride?: string[] | null;
  trigger: "cron" | "http";
};

async function runSummary(
  period: SummaryPeriod,
  options: RunSummaryOptions,
): Promise<SummaryResult> {
  const recipients = resolveRecipients(options.recipientsOverride);
  const lookbackStartIso = new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const { highlights, rightsExpiring } = await fetchHighlights(period, {
    limit: options.limit,
    lookbackStartIso,
  });

  const message = buildMessage(period, {
    highlights,
    rightsExpiring,
    lookbackDays: options.lookbackDays,
    trigger: options.trigger,
  });

  const deliveries: SummaryResult["deliveries"] = [];
  if (!options.dryRun) {
    for (const to of recipients) {
      try {
        const result = await queueNotification(
          {
            to,
            text: message,
          },
          {
            type: `video_performance_${period}`,
          },
        );
        deliveries.push({ to, queued: true, notificationId: result.id });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error ?? "error");
        await logStructuredEvent("ERROR", { data: "video-performance-summary.enqueue_failed", { to, error: detail } });
        deliveries.push({ to, queued: false, error: detail });
      }
    }
  }

  return {
    period,
    lookbackDays: options.lookbackDays,
    lookbackStart: lookbackStartIso,
    highlights,
    rightsExpiring,
    message,
    recipients,
    deliveries,
  };
}

type FetchHighlightsOptions = {
  limit: number;
  lookbackStartIso: string;
};

async function fetchHighlights(
  period: SummaryPeriod,
  options: FetchHighlightsOptions,
): Promise<{ highlights: Highlight[]; rightsExpiring: RightsExpiry[] }> {
  const { data, error } = await supabase
    .from("video_performance")
    .select(
      `job_id,slot,hook_label,cta_variant,interval,interval_start,renders,approvals,whatsapp_clicks,approval_rate,click_through_rate,cost_per_render,insights,metadata,
        job:video_jobs(id,campaign_id,template_label,hook_label,cta_variant,script_version,rights_expiry_at,render_currency)`
    )
    .eq("interval", period)
    .gte("interval_start", options.lookbackStartIso)
    .order("interval_start", { ascending: false })
    .limit(Math.max(options.limit * 6, options.limit));

  if (error) {
    await logStructuredEvent("ERROR", { data: "video-performance-summary.fetch_highlights_failed", error });
    return { highlights: [], rightsExpiring: await fetchRightsExpiring() };
  }

  const rows = (data ?? []) as PerformanceRow[];
  const seen = new Set<string>();
  const highlights: Highlight[] = [];

  for (const row of rows) {
    const jobId = row.job_id ?? row.job?.id;
    if (!jobId || seen.has(jobId)) continue;

    const renders = toNumber(row.renders);
    const approvals = toNumber(row.approvals);
    const approvalRate = toRatio(row.approval_rate);
    const clickRate = toRatio(row.click_through_rate);
    const cost = row.cost_per_render ?? null;
    const hookLabel = valueOrFallback(row.hook_label, row.job?.hook_label, "Unnamed hook");
    const templateLabel = valueOrFallback(row.metadata?.template_label as string | undefined, row.job?.template_label, "Unnamed template");

    const score = computeScore({
      approvalRate,
      clickRate,
      cost,
      approvals,
      renders,
    });

    highlights.push({
      jobId,
      slot: row.slot,
      hookLabel,
      templateLabel,
      scriptVersion: row.job?.script_version ?? null,
      approvals,
      renders,
      approvalRate,
      clickThroughRate: clickRate,
      costPerRender: cost,
      score,
      ctaVariant: row.cta_variant ?? row.job?.cta_variant ?? null,
      intervalStart: row.interval_start,
      rightsExpiryAt: row.job?.rights_expiry_at ?? (row.metadata?.rights_expiry_at as string | null) ?? null,
      renderCurrency: row.job?.render_currency ?? (row.metadata?.render_currency as string | null) ?? null,
    });

    seen.add(jobId);
    if (highlights.length >= options.limit) break;
  }

  highlights.sort((a, b) => b.score - a.score);

  const rightsExpiring = await fetchRightsExpiring();

  return { highlights, rightsExpiring };
}

async function fetchRightsExpiring(): Promise<RightsExpiry[]> {
  const cutoff = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("video_jobs")
    .select("id,slot,hook_label,script_version,rights_expiry_at")
    .not("rights_expiry_at", "is", null)
    .gte("rights_expiry_at", nowIso)
    .lte("rights_expiry_at", cutoff)
    .order("rights_expiry_at", { ascending: true })
    .limit(10);

  if (error) {
    await logStructuredEvent("ERROR", { data: "video-performance-summary.fetch_rights_failed", error });
    return [];
  }

  return (data ?? []).map((row) => {
    const expiry = new Date(row.rights_expiry_at as string);
    const daysRemaining = Math.max(
      0,
      Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    return {
      jobId: row.id as string,
      slot: row.slot as string,
      hookLabel: valueOrFallback(row.hook_label as string | null, null, "Unnamed hook"),
      scriptVersion: (row.script_version as string | null) ?? null,
      rightsExpiryAt: expiry.toISOString(),
      daysRemaining,
    } satisfies RightsExpiry;
  });
}

function buildMessage(
  period: SummaryPeriod,
  data: {
    highlights: Highlight[];
    rightsExpiring: RightsExpiry[];
    lookbackDays: number;
    trigger: "cron" | "http";
  },
): string {
  const headerEmoji = period === "daily" ? "📊" : "📈";
  const rangeLabel = period === "daily" ? "Daily" : "Weekly";
  const summaryDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

  const lines: string[] = [];
  lines.push(`${headerEmoji} ${rangeLabel} video performance — ${summaryDate}`);
  lines.push(`Lookback: last ${data.lookbackDays} day${data.lookbackDays === 1 ? "" : "s"}`);
  lines.push("");

  if (data.highlights.length === 0) {
    lines.push("No performance data captured in the selected window.");
  } else {
    lines.push("Top performing variants:");
    data.highlights.forEach((entry, index) => {
      const rank = index + 1;
      const approval = formatPercent(entry.approvalRate);
      const ctr = formatPercent(entry.clickThroughRate);
      const cost = entry.costPerRender != null
        ? formatCurrency(entry.costPerRender, entry.renderCurrency)
        : "n/a";
      const slotLabel = entry.slot ? `(${entry.slot})` : "";
      const hook = entry.hookLabel ?? entry.templateLabel;
      const variant = entry.ctaVariant ? ` • CTA: ${entry.ctaVariant}` : "";
      lines.push(
        `${rank}. ${hook} ${slotLabel} — approvals ${approval}, CTR ${ctr}, cost/render ${cost}${variant}`,
      );
    });
  }

  lines.push("");
  if (data.rightsExpiring.length) {
    lines.push("⚠️ Rights expiring soon:");
    data.rightsExpiring.forEach((entry) => {
      lines.push(
        `• ${entry.hookLabel} (${entry.slot}) expires ${formatDate(entry.rightsExpiryAt)} — ${entry.daysRemaining} day${entry.daysRemaining === 1 ? "" : "s"}`,
      );
    });
  } else {
    lines.push("✅ Rights windows clear for the next two weeks.");
  }

  lines.push("");
  lines.push(`Triggered via ${data.trigger === "cron" ? "scheduled cron" : "manual API"}.`);

  return lines.join("\n");
}

function resolveRecipients(override: string[] | null | undefined): string[] {
  if (override && override.length) {
    return override;
  }

  const raw = Deno.env.get("VIDEO_ANALYTICS_WHATSAPP_RECIPIENTS") ?? "";
  const parts = raw
    .split(/[,\n\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    await logStructuredEvent("WARNING", { data: "video-performance-summary.recipients_missing" });
  }

  return parts;
}

function computeScore(input: {
  approvalRate: number;
  clickRate: number;
  cost: number | null;
  approvals: number;
  renders: number;
}): number {
  const base = input.approvalRate * 100;
  const engagement = input.clickRate * 70;
  const volumeBoost = input.renders > 0 ? Math.log10(input.renders + 1) * 10 : 0;
  const costPenalty = input.cost != null ? Math.min(input.cost, 20) * 5 : 0;
  return base + engagement + volumeBoost - costPenalty + input.approvals * 0.5;
}

function toNumber(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function toRatio(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(value, 0);
  return 0;
}

function valueOrFallback(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    if (value && value.trim().length) return value.trim();
  }
  return "Unnamed";
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number, currency: string | null | undefined): string {
  const symbol = currencySymbol(currency);
  return `${symbol}${value.toFixed(2)}`;
}

function currencySymbol(currency: string | null | undefined): string {
  if (!currency) return "$";
  switch (currency.toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "RWF":
      return "RWF ";
    case "KES":
      return "KES ";
    default:
      return `${currency.toUpperCase()} `;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
