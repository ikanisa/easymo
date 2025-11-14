import 'server-only';

import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

export type VideoAnalyticsDashboardData = {
  isSample: boolean;
  lookbackDays: number;
  totals: {
    renders: number;
    approvals: number;
    changesRequested: number;
    whatsappClicks: number;
    approvalRate: number;
    clickThroughRate: number;
    averageCostPerRender: number | null;
  };
  retentionTimeline: Array<{ label: string; value: number }>;
  hookLeaders: Array<{
    jobId: string;
    slot: string;
    hookLabel: string;
    templateLabel: string | null;
    approvalRate: number;
    clickThroughRate: number;
    costPerRender: number | null;
    renders: number;
    approvals: number;
    rightsExpiryAt: string | null;
  }>;
  ctaEffectiveness: Array<{
    ctaVariant: string;
    clickRate: number;
    approvals: number;
    renders: number;
    whatsappClicks: number;
    exemplarJobId: string | null;
    exemplarSlot: string | null;
  }>;
  costPerRenderTimeline: Array<{ label: string; value: number }>;
  jobs: Array<VideoJobSummary>;
  rightsExpiring: Array<{
    jobId: string;
    hookLabel: string;
    slot: string;
    rightsExpiryAt: string;
    daysRemaining: number;
  }>;
  lastRefreshedAt: string | null;
};

export type VideoJobSummary = {
  id: string;
  slot: string;
  templateLabel: string | null;
  hookLabel: string | null;
  scriptVersion: string | null;
  rightsExpiryAt: string | null;
  campaignId: string | null;
  renderCurrency: string | null;
  metrics: {
    renders: number;
    approvals: number;
    changesRequested: number;
    whatsappClicks: number;
    approvalRate: number;
    clickThroughRate: number;
    costPerRender: number | null;
  };
};

export type VideoJobDetail = VideoJobSummary & {
  ctaVariant: string | null;
  insights: string[];
  approvals: Array<{
    id: string;
    status: string;
    reviewerName: string | null;
    summary: string | null;
    requestedChanges: string | null;
    whatsappClicks: number;
    lastWhatsappClickAt: string | null;
    approvedAt: string | null;
    changesRequestedAt: string | null;
    createdAt: string;
  }>;
  performance: Array<{
    interval: string;
    intervalStart: string;
    renders: number;
    approvals: number;
    clickThroughRate: number;
    approvalRate: number;
    costPerRender: number | null;
  }>;
};

type PerformanceRow = {
  id: string;
  job_id: string;
  slot: string;
  template_label: string | null;
  template_id: string | null;
  hook_label: string | null;
  hook_id: string | null;
  cta_variant: string | null;
  interval: string;
  interval_start: string;
  renders: number | null;
  approvals: number | null;
  changes_requested: number | null;
  whatsapp_clicks: number | null;
  approval_rate: number | null;
  click_through_rate: number | null;
  cost_per_render: number | null;
  insights: string | null;
  metadata: Record<string, unknown> | null;
  job: {
    id: string;
    slot: string;
    template_label: string | null;
    template_id: string | null;
    hook_label: string | null;
    hook_id: string | null;
    cta_variant: string | null;
    script_version: string | null;
    rights_expiry_at: string | null;
    campaign_id: string | null;
    render_currency: string | null;
    approvals_count: number | null;
    changes_requested_count: number | null;
    whatsapp_clicks: number | null;
    renders: number | null;
    metadata: Record<string, unknown> | null;
  } | null;
};

type ApprovalRow = {
  id: string;
  job_id: string;
  reviewer_name: string | null;
  status: string;
  summary: string | null;
  requested_changes: string | null;
  whatsapp_clicks: number | null;
  last_whatsapp_click_at: string | null;
  approved_at: string | null;
  changes_requested_at: string | null;
  created_at: string;
};

function coercePerformanceRows(rows: unknown[] | null | undefined): PerformanceRow[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => {
    const candidate = row as PerformanceRow & {
      job?: PerformanceRow["job"] | PerformanceRow["job"][] | null;
    };

    const jobValue = candidate.job;
    const normalizedJob = Array.isArray(jobValue)
      ? (jobValue[0] as PerformanceRow["job"] | undefined) ?? null
      : jobValue ?? null;

    return {
      ...candidate,
      job: normalizedJob,
    };
  });
}

const SAMPLE_DASHBOARD: VideoAnalyticsDashboardData = {
  isSample: true,
  lookbackDays: 14,
  totals: {
    renders: 128,
    approvals: 56,
    changesRequested: 9,
    whatsappClicks: 74,
    approvalRate: 0.44,
    clickThroughRate: 0.58,
    averageCostPerRender: 2.35,
  },
  retentionTimeline: [
    { label: 'Day -6', value: 0.38 },
    { label: 'Day -5', value: 0.41 },
    { label: 'Day -4', value: 0.43 },
    { label: 'Day -3', value: 0.45 },
    { label: 'Day -2', value: 0.47 },
    { label: 'Day -1', value: 0.49 },
    { label: 'Today', value: 0.52 },
  ],
  hookLeaders: [
    {
      jobId: 'sample-hero',
      slot: 'hero',
      hookLabel: 'Founder intro + success metrics',
      templateLabel: 'Momentum template A',
      approvalRate: 0.58,
      clickThroughRate: 0.63,
      costPerRender: 2.21,
      renders: 36,
      approvals: 21,
      rightsExpiryAt: null,
    },
    {
      jobId: 'sample-product',
      slot: 'product',
      hookLabel: 'Screen demo walkthrough',
      templateLabel: 'Product demo B',
      approvalRate: 0.46,
      clickThroughRate: 0.59,
      costPerRender: 2.48,
      renders: 44,
      approvals: 20,
      rightsExpiryAt: null,
    },
  ],
  ctaEffectiveness: [
    {
      ctaVariant: 'Chat with us on WhatsApp',
      clickRate: 0.61,
      approvals: 26,
      renders: 52,
      whatsappClicks: 32,
      exemplarJobId: 'sample-hero',
      exemplarSlot: 'hero',
    },
    {
      ctaVariant: 'Book a store tour',
      clickRate: 0.46,
      approvals: 18,
      renders: 39,
      whatsappClicks: 18,
      exemplarJobId: 'sample-product',
      exemplarSlot: 'product',
    },
  ],
  costPerRenderTimeline: [
    { label: 'Day -6', value: 2.61 },
    { label: 'Day -5', value: 2.58 },
    { label: 'Day -4', value: 2.51 },
    { label: 'Day -3', value: 2.47 },
    { label: 'Day -2', value: 2.39 },
    { label: 'Day -1', value: 2.32 },
    { label: 'Today', value: 2.28 },
  ],
  jobs: [
    {
      id: 'sample-hero',
      slot: 'hero',
      templateLabel: 'Momentum template A',
      hookLabel: 'Founder intro + success metrics',
      scriptVersion: 'v3',
      rightsExpiryAt: null,
      campaignId: null,
      renderCurrency: 'USD',
      metrics: {
        renders: 58,
        approvals: 26,
        changesRequested: 4,
        whatsappClicks: 34,
        approvalRate: 0.45,
        clickThroughRate: 0.59,
        costPerRender: 2.21,
      },
    },
    {
      id: 'sample-product',
      slot: 'product',
      templateLabel: 'Product demo B',
      hookLabel: 'Screen demo walkthrough',
      scriptVersion: 'v2',
      rightsExpiryAt: null,
      campaignId: null,
      renderCurrency: 'USD',
      metrics: {
        renders: 70,
        approvals: 30,
        changesRequested: 5,
        whatsappClicks: 40,
        approvalRate: 0.43,
        clickThroughRate: 0.57,
        costPerRender: 2.48,
      },
    },
  ],
  rightsExpiring: [],
  lastRefreshedAt: null,
};

export async function getVideoAnalyticsDashboardData(options?: {
  lookbackDays?: number;
}): Promise<VideoAnalyticsDashboardData> {
  const supabase = await getSupabaseAdminClient();
  const lookbackDays = options?.lookbackDays ?? 14;

  if (!supabase) {
    return SAMPLE_DASHBOARD;
  }

  const lookbackStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('video_performance')
    .select(`id,job_id,slot,template_label,template_id,hook_label,hook_id,cta_variant,interval,interval_start,renders,approvals,changes_requested,whatsapp_clicks,approval_rate,click_through_rate,cost_per_render,insights,metadata,
      job:video_jobs(id,slot,template_label,template_id,hook_label,hook_id,cta_variant,script_version,rights_expiry_at,campaign_id,render_currency,approvals_count,changes_requested_count,whatsapp_clicks,renders,metadata)`)
    .in('interval', ['daily', 'weekly', 'lifetime'])
    .gte('interval_start', lookbackStart)
    .order('interval_start', { ascending: true });

  if (error || !data) {
    console.error('video-analytics.dashboard_failed', error);
    return SAMPLE_DASHBOARD;
  }

  const rows = coercePerformanceRows(data);
  const dailyRows = rows.filter((row) => row.interval === 'daily');
  const weeklyRows = rows.filter((row) => row.interval === 'weekly');
  const lifetimeRows = rows.filter((row) => row.interval === 'lifetime');

  const totals = aggregateTotals(dailyRows);
  const retentionTimeline = buildRetentionTimeline(dailyRows);
  const hookLeaders = buildHookLeaders(dailyRows);
  const ctaEffectiveness = buildCtaEffectiveness(dailyRows);
  const costPerRenderTimeline = buildCostTimeline(dailyRows);
  const jobSummaries = buildJobSummaries(lifetimeRows, dailyRows);
  const rightsExpiring = jobSummaries
    .filter((job) => job.rightsExpiryAt)
    .map((job) => ({
      jobId: job.id,
      hookLabel: job.hookLabel ?? 'Unnamed hook',
      slot: job.slot,
      rightsExpiryAt: job.rightsExpiryAt!,
      daysRemaining: daysUntil(job.rightsExpiryAt!),
    }))
    .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 14)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const lastRefreshedAt = rows.reduce<string | null>((acc, row) => {
    if (!row.interval_start) return acc;
    if (!acc) return row.interval_start;
    return row.interval_start > acc ? row.interval_start : acc;
  }, null);

  return {
    isSample: false,
    lookbackDays,
    totals,
    retentionTimeline,
    hookLeaders,
    ctaEffectiveness,
    costPerRenderTimeline,
    jobs: jobSummaries,
    rightsExpiring,
    lastRefreshedAt,
  };
}

export async function getVideoJobDetail(id: string): Promise<VideoJobDetail | null> {
  const supabase = await getSupabaseAdminClient();
  if (!supabase) {
    const sample = SAMPLE_DASHBOARD.jobs[0];
    return sample
      ? {
          ...sample,
          ctaVariant: 'Book on WhatsApp',
          insights: ['Sample data — connect Supabase for live analytics.'],
          approvals: [],
          performance: [],
        }
      : null;
  }

  const { data: jobRows, error } = await supabase
    .from('video_performance')
    .select(`job_id,slot,template_label,template_id,hook_label,hook_id,cta_variant,interval,interval_start,renders,approvals,changes_requested,whatsapp_clicks,approval_rate,click_through_rate,cost_per_render,insights,metadata,
      job:video_jobs(id,slot,template_label,template_id,hook_label,hook_id,cta_variant,script_version,rights_expiry_at,campaign_id,render_currency,approvals_count,changes_requested_count,whatsapp_clicks,renders,metadata)`)
    .eq('job_id', id)
    .order('interval_start', { ascending: false });

  if (error || !jobRows || jobRows.length === 0) {
    return null;
  }

  const rows = coercePerformanceRows(jobRows);
  const baseRow = rows.find((row) => row.interval === 'lifetime') ?? rows[0];
  const summary = performanceRowToSummary(baseRow);

  const { data: approvalRows, error: approvalError } = await supabase
    .from('video_approvals')
    .select('id,job_id,reviewer_name,status,summary,requested_changes,whatsapp_clicks,last_whatsapp_click_at,approved_at,changes_requested_at,created_at')
    .eq('job_id', id)
    .order('created_at', { ascending: false });

  if (approvalError) {
    console.error('video-analytics.approvals_failed', approvalError);
  }

  return {
    ...summary,
    ctaVariant: baseRow.cta_variant ?? baseRow.job?.cta_variant ?? null,
    insights: collectInsights(rows),
    approvals: (approvalRows ?? []).map(mapApprovalRow),
    performance: rows.map((row) => ({
      interval: row.interval,
      intervalStart: row.interval_start,
      renders: toNumber(row.renders),
      approvals: toNumber(row.approvals),
      clickThroughRate: toRatio(row.click_through_rate),
      approvalRate: toRatio(row.approval_rate),
      costPerRender: row.cost_per_render ?? null,
    })),
  };
}

function aggregateTotals(rows: PerformanceRow[]): VideoAnalyticsDashboardData['totals'] {
  const totals = rows.reduce(
    (acc, row) => {
      const renders = toNumber(row.renders);
      const approvals = toNumber(row.approvals);
      const changes = toNumber(row.changes_requested);
      const clicks = toNumber(row.whatsapp_clicks);
      const cost = row.cost_per_render ?? null;

      acc.renders += renders;
      acc.approvals += approvals;
      acc.changesRequested += changes;
      acc.whatsappClicks += clicks;
      if (cost != null) {
        acc._costSamples.push(cost);
      }
      acc._approvalPairs.push({ numerator: approvals, denominator: renders });
      acc._clickPairs.push({ numerator: clicks, denominator: renders });
      return acc;
    },
    {
      renders: 0,
      approvals: 0,
      changesRequested: 0,
      whatsappClicks: 0,
      _costSamples: [] as number[],
      _approvalPairs: [] as Array<{ numerator: number; denominator: number }>,
      _clickPairs: [] as Array<{ numerator: number; denominator: number }>,
    },
  );

  const approvalRate = computeRate(totals._approvalPairs);
  const clickThroughRate = computeRate(totals._clickPairs);
  const averageCostPerRender = totals._costSamples.length
    ? totals._costSamples.reduce((sum, value) => sum + value, 0) / totals._costSamples.length
    : null;

  return {
    renders: totals.renders,
    approvals: totals.approvals,
    changesRequested: totals.changesRequested,
    whatsappClicks: totals.whatsappClicks,
    approvalRate,
    clickThroughRate,
    averageCostPerRender,
  };
}

function buildRetentionTimeline(rows: PerformanceRow[]): Array<{ label: string; value: number }> {
  const grouped = groupByDate(rows, (row) => toRatio(row.approval_rate));
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

function buildHookLeaders(rows: PerformanceRow[]): VideoAnalyticsDashboardData['hookLeaders'] {
  const grouped = rows.reduce<Record<string, { row: PerformanceRow; rate: number }>>((acc, row) => {
    const key = row.job_id ?? row.job?.id;
    if (!key) return acc;
    const rate = toRatio(row.approval_rate);
    const existing = acc[key];
    if (!existing || existing.rate < rate) {
      acc[key] = { row, rate };
    }
    return acc;
  }, {});

  const leaders = Object.values(grouped)
    .map(({ row, rate }) => ({
      jobId: row.job_id ?? row.job?.id ?? 'unknown',
      slot: row.slot,
      hookLabel: row.hook_label ?? row.job?.hook_label ?? 'Unnamed hook',
      templateLabel: row.template_label ?? row.job?.template_label ?? null,
      approvalRate: rate,
      clickThroughRate: toRatio(row.click_through_rate),
      costPerRender: row.cost_per_render ?? null,
      renders: toNumber(row.renders),
      approvals: toNumber(row.approvals),
      rightsExpiryAt: row.job?.rights_expiry_at ?? (row.metadata?.rights_expiry_at as string | null) ?? null,
    }))
    .sort((a, b) => b.approvalRate - a.approvalRate)
    .slice(0, 6);

  return leaders;
}

function buildCtaEffectiveness(rows: PerformanceRow[]): VideoAnalyticsDashboardData['ctaEffectiveness'] {
  const grouped = new Map<string, {
    renders: number;
    approvals: number;
    clicks: number;
    exemplarJobId: string | null;
    exemplarSlot: string | null;
  }>();

  for (const row of rows) {
    const variant = row.cta_variant ?? row.job?.cta_variant ?? 'Unspecified';
    const entry = grouped.get(variant) ?? {
      renders: 0,
      approvals: 0,
      clicks: 0,
      exemplarJobId: row.job_id ?? row.job?.id ?? null,
      exemplarSlot: row.slot ?? null,
    };
    entry.renders += toNumber(row.renders);
    entry.approvals += toNumber(row.approvals);
    entry.clicks += toNumber(row.whatsapp_clicks);
    if (!entry.exemplarJobId) {
      entry.exemplarJobId = row.job_id ?? row.job?.id ?? null;
      entry.exemplarSlot = row.slot ?? null;
    }
    grouped.set(variant, entry);
  }

  return Array.from(grouped.entries())
    .map(([ctaVariant, entry]) => ({
      ctaVariant,
      approvals: entry.approvals,
      renders: entry.renders,
      whatsappClicks: entry.clicks,
      clickRate: entry.renders > 0 ? entry.clicks / entry.renders : 0,
      exemplarJobId: entry.exemplarJobId,
      exemplarSlot: entry.exemplarSlot,
    }))
    .sort((a, b) => b.clickRate - a.clickRate)
    .slice(0, 6);
}

function buildCostTimeline(rows: PerformanceRow[]): Array<{ label: string; value: number }> {
  const grouped = groupByDate(rows.filter((row) => row.cost_per_render != null), (row) => row.cost_per_render ?? 0);
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

function buildJobSummaries(lifetimeRows: PerformanceRow[], dailyRows: PerformanceRow[]): VideoJobSummary[] {
  const jobs = new Map<string, VideoJobSummary>();

  for (const row of lifetimeRows) {
    const summary = performanceRowToSummary(row);
    jobs.set(summary.id, summary);
  }

  for (const row of dailyRows) {
    const id = row.job_id ?? row.job?.id;
    if (!id) continue;
    const summary = jobs.get(id) ?? performanceRowToSummary(row);
    const renders = toNumber(row.renders);
    const approvals = toNumber(row.approvals);
    const changes = toNumber(row.changes_requested);
    const clicks = toNumber(row.whatsapp_clicks);
    const cost = row.cost_per_render ?? summary.metrics.costPerRender;
    const approvalRate = renders > 0 ? approvals / renders : summary.metrics.approvalRate;
    const clickRate = renders > 0 ? clicks / renders : summary.metrics.clickThroughRate;

    summary.metrics = {
      renders,
      approvals,
      changesRequested: changes,
      whatsappClicks: clicks,
      approvalRate,
      clickThroughRate: clickRate,
      costPerRender: cost,
    };

    jobs.set(id, summary);
  }

  return Array.from(jobs.values()).sort((a, b) => b.metrics.approvalRate - a.metrics.approvalRate);
}

function performanceRowToSummary(row: PerformanceRow): VideoJobSummary {
  const jobId = row.job_id ?? row.job?.id ?? 'unknown';
  const renders = toNumber(row.renders ?? row.job?.renders);
  const approvals = toNumber(row.approvals ?? row.job?.approvals_count);
  const changes = toNumber(row.changes_requested ?? row.job?.changes_requested_count);
  const clicks = toNumber(row.whatsapp_clicks ?? row.job?.whatsapp_clicks);
  const approvalRate = renders > 0 ? approvals / renders : toRatio(row.approval_rate);
  const clickRate = renders > 0 ? clicks / renders : toRatio(row.click_through_rate);
  const cost = row.cost_per_render ?? (row.metadata?.cost_per_render as number | null) ?? null;

  return {
    id: jobId,
    slot: row.slot ?? row.job?.slot ?? 'unspecified',
    templateLabel: row.template_label ?? row.job?.template_label ?? null,
    hookLabel: row.hook_label ?? row.job?.hook_label ?? null,
    scriptVersion: row.job?.script_version ?? (row.metadata?.script_version as string | null) ?? null,
    rightsExpiryAt: row.job?.rights_expiry_at ?? (row.metadata?.rights_expiry_at as string | null) ?? null,
    campaignId: row.job?.campaign_id ?? (row.metadata?.campaign_id as string | null) ?? null,
    renderCurrency: row.job?.render_currency ?? (row.metadata?.render_currency as string | null) ?? null,
    metrics: {
      renders,
      approvals,
      changesRequested: changes,
      whatsappClicks: clicks,
      approvalRate,
      clickThroughRate: clickRate,
      costPerRender: cost,
    },
  };
}

function collectInsights(rows: PerformanceRow[]): string[] {
  const insights = new Set<string>();
  for (const row of rows) {
    if (row.insights) insights.add(row.insights);
    const metaInsights = row.metadata?.insights;
    if (typeof metaInsights === 'string') insights.add(metaInsights);
    if (Array.isArray(metaInsights)) {
      metaInsights.forEach((item) => {
        if (typeof item === 'string') insights.add(item);
      });
    }
  }
  return Array.from(insights);
}

function mapApprovalRow(row: ApprovalRow) {
  return {
    id: row.id,
    status: row.status,
    reviewerName: row.reviewer_name,
    summary: row.summary,
    requestedChanges: row.requested_changes,
    whatsappClicks: toNumber(row.whatsapp_clicks),
    lastWhatsappClickAt: row.last_whatsapp_click_at,
    approvedAt: row.approved_at,
    changesRequestedAt: row.changes_requested_at,
    createdAt: row.created_at,
  };
}

function groupByDate(rows: PerformanceRow[], selector: (row: PerformanceRow) => number): Record<string, number> {
  const buckets = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (!row.interval_start) continue;
    const label = formatDateLabel(row.interval_start);
    const entry = buckets.get(label) ?? { total: 0, count: 0 };
    const value = selector(row);
    entry.total += value;
    entry.count += 1;
    buckets.set(label, entry);
  }

  const result: Record<string, number> = {};
  for (const [label, bucket] of buckets.entries()) {
    result[label] = bucket.count > 0 ? bucket.total / bucket.count : 0;
  }
  return result;
}

function computeRate(pairs: Array<{ numerator: number; denominator: number }>): number {
  let numerator = 0;
  let denominator = 0;
  for (const pair of pairs) {
    numerator += pair.numerator;
    denominator += pair.denominator;
  }
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function toNumber(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

function toRatio(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(value, 0);
  return 0;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.round((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Day -1';
  return `Day -${diffDays}`;
}

function daysUntil(value: string): number {
  const target = new Date(value);
  return Math.round((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
