import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { logToolInvocation } from '../observability';
import type { AgentContext } from '../types';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'agents' });

const scriptPlannerSchema = z.object({
  campaignId: z.string().uuid().optional(),
  slots: z.array(z.string().min(1, 'Slot key is required')).min(1, 'At least one slot is required'),
  lookbackDays: z.number().int().min(1).max(60).default(14),
  limit: z.number().int().min(1).max(5).default(3),
  supabaseUrl: z.string().url().optional(),
  supabaseServiceRoleKey: z.string().min(1).optional(),
});

export type ScriptPlannerParams = z.infer<typeof scriptPlannerSchema>;

export type PlannerVariant = {
  templateId: string | null;
  templateLabel: string | null;
  hookId: string | null;
  hookLabel: string | null;
  scriptVersion: string | null;
  ctaVariant: string | null;
  rightsExpiryAt: string | null;
  metrics: {
    renders: number;
    approvals: number;
    changesRequested: number;
    whatsappClicks: number;
    approvalRate: number;
    clickThroughRate: number;
    costPerRender: number | null;
    score: number;
  };
  narrative: string;
  recommendedExperiments: string[];
};

export type PlannerSlotRecommendation = {
  slot: string;
  primary: PlannerVariant;
  challenger: PlannerVariant;
  retrievalContext: string[];
};

export type ScriptPlannerResult = {
  generatedAt: string;
  lookbackWindowDays: number;
  source: 'live' | 'synthetic';
  slots: PlannerSlotRecommendation[];
};

type PerformanceRow = {
  job_id: string;
  slot: string;
  template_id: string | null;
  template_label: string | null;
  hook_id: string | null;
  hook_label: string | null;
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
    campaign_id: string | null;
    template_id: string | null;
    template_label: string | null;
    hook_id: string | null;
    hook_label: string | null;
    cta_variant: string | null;
    script_version: string | null;
    rights_expiry_at: string | null;
    render_currency: string | null;
    approvals_count: number | null;
    changes_requested_count: number | null;
    whatsapp_clicks: number | null;
    renders: number | null;
    metadata: Record<string, unknown> | null;
  } | null;
};

type RowWithScore = { row: PerformanceRow; score: number };

type SupabaseQueryContext = {
  client: SupabaseClient;
  params: Required<Pick<ScriptPlannerParams, 'slots' | 'lookbackDays' | 'limit'>> & Pick<ScriptPlannerParams, 'campaignId'>;
};

export async function executeScriptPlanner(
  rawParams: ScriptPlannerParams,
  context: AgentContext,
): Promise<ScriptPlannerResult> {
  const params = scriptPlannerSchema.parse(rawParams);
  await logToolInvocation('ScriptPlanner', context, params);

  const client = createSupabaseClient(params);
  if (!client) {
    return buildFallbackPlan(params.slots, params.lookbackDays, 'synthetic');
  }

  const rows = await fetchPerformanceRows({
    client,
    params: {
      slots: params.slots,
      lookbackDays: params.lookbackDays,
      limit: params.limit,
      campaignId: params.campaignId,
    },
  });

  if (!rows.length) {
    return buildFallbackPlan(params.slots, params.lookbackDays, 'synthetic');
  }

  const grouped = groupRowsBySlot(rows);
  const recommendations: PlannerSlotRecommendation[] = [];

  for (const slot of params.slots) {
    const scoredRows = grouped.get(slot) ?? [];
    if (!scoredRows.length) {
      recommendations.push(buildFallbackSlot(slot));
      continue;
    }

    const [primaryEntry, challengerEntry] = scoredRows;
    const primaryVariant = buildVariantFromRow(primaryEntry.row, primaryEntry.score);
    const challengerVariant = challengerEntry
      ? buildVariantFromRow(challengerEntry.row, challengerEntry.score, primaryVariant)
      : buildChallengerFromPrimary(primaryVariant);

    const retrievalContext = buildRetrievalContext(scoredRows.slice(0, 3));

    recommendations.push({
      slot,
      primary: primaryVariant,
      challenger: challengerVariant,
      retrievalContext,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    lookbackWindowDays: params.lookbackDays,
    source: 'live',
    slots: recommendations,
  };
}

function createSupabaseClient(params: ScriptPlannerParams): SupabaseClient | null {
  const url = params.supabaseUrl
    ?? process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? null;
  const key = params.supabaseServiceRoleKey
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_KEY
    ?? process.env.SUPABASE_ANON_KEY
    ?? null;

  if (!url || !key) return null;

  try {
    return createClient(url, key, { auth: { persistSession: false } });
  } catch (error) {
    log.warn('script-planner.supabase_init_failed', error);
    return null;
  }
}

async function fetchPerformanceRows({
  client,
  params,
}: SupabaseQueryContext): Promise<RowWithScore[]> {
  const lookbackStart = new Date(Date.now() - params.lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  let query = client
    .from('video_performance')
    .select(`job_id,slot,template_id,template_label,hook_id,hook_label,cta_variant,interval,interval_start,renders,approvals,changes_requested,whatsapp_clicks,approval_rate,click_through_rate,cost_per_render,insights,metadata,
      job:video_jobs(id,campaign_id,template_id,template_label,hook_id,hook_label,cta_variant,script_version,rights_expiry_at,render_currency,approvals_count,changes_requested_count,whatsapp_clicks,renders,metadata)`)
    .eq('interval', 'daily')
    .gte('interval_start', lookbackStart)
    .in('slot', params.slots)
    .order('interval_start', { ascending: false })
    .limit(Math.max(params.limit * params.slots.length * 6, params.limit));

  if (params.campaignId) {
    query = query.eq('job.campaign_id', params.campaignId);
  }

  const { data, error } = await query;
  if (error) {
    log.error('script-planner.fetch_failed', error);
    return [];
  }

  const rows = (data ?? []) as unknown as PerformanceRow[];
  const scored: RowWithScore[] = rows.map((row) => ({
    row,
    score: computeScore(row),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function groupRowsBySlot(rows: RowWithScore[]): Map<string, RowWithScore[]> {
  const map = new Map<string, RowWithScore[]>();
  for (const entry of rows) {
    if (!entry.row.slot) continue;
    const existing = map.get(entry.row.slot) ?? [];
    existing.push(entry);
    existing.sort((a, b) => b.score - a.score);
    map.set(entry.row.slot, existing.slice(0, 4));
  }
  return map;
}

function buildVariantFromRow(row: PerformanceRow, score: number, baseline?: PlannerVariant): PlannerVariant {
  const job = row.job ?? null;
  const renders = toNumber(row.renders ?? job?.renders);
  const approvals = toNumber(row.approvals ?? job?.approvals_count);
  const changesRequested = toNumber(row.changes_requested ?? job?.changes_requested_count);
  const whatsappClicks = toNumber(row.whatsapp_clicks ?? job?.whatsapp_clicks);
  const approvalRate = toRatio(row.approval_rate, baseline?.metrics.approvalRate);
  const clickRate = toRatio(row.click_through_rate, baseline?.metrics.clickThroughRate);
  const costPerRender = row.cost_per_render ?? baseline?.metrics.costPerRender ?? null;
  const rightsExpiry = job?.rights_expiry_at
    ?? (row.metadata?.rights_expiry_at as string | null)
    ?? baseline?.rightsExpiryAt
    ?? null;

  const renderCurrency = job?.render_currency ?? (row.metadata?.render_currency as string | null) ?? null;

  const narrativeParts = [
    `Approval rate ${formatPercent(approvalRate)} with CTR ${formatPercent(clickRate)}.`,
    costPerRender != null
      ? `Cost per render ${formatCurrency(costPerRender, renderCurrency)}.`
      : 'Cost per render not yet recorded — monitor first 10 renders.',
    whatsappClicks > 0
      ? `Captured ${whatsappClicks} WhatsApp tap${whatsappClicks === 1 ? '' : 's'} over the window.`
      : 'No WhatsApp taps yet — tighten CTA focus.',
  ];

  const experiments: string[] = [];
  if (clickRate < 0.12) experiments.push('Test shorter CTA microcopy to raise tap-through rate.');
  if (approvalRate < 0.4) experiments.push('Front-load credibility proof in the first 5 seconds to lift approvals.');
  if (rightsExpiry && daysUntil(rightsExpiry) < 7) experiments.push('Renew rights or prep alternate footage before expiry.');

  return {
    templateId: job?.template_id ?? (row.metadata?.template_id as string | null) ?? row.template_id ?? baseline?.templateId ?? null,
    templateLabel: job?.template_label ?? (row.metadata?.template_label as string | null) ?? row.template_label ?? baseline?.templateLabel ?? null,
    hookId: job?.hook_id ?? (row.metadata?.hook_id as string | null) ?? row.hook_id ?? baseline?.hookId ?? null,
    hookLabel: row.hook_label ?? job?.hook_label ?? baseline?.hookLabel ?? 'Untitled hook',
    scriptVersion: job?.script_version ?? (row.metadata?.script_version as string | null) ?? baseline?.scriptVersion ?? null,
    ctaVariant: row.cta_variant ?? job?.cta_variant ?? (row.metadata?.cta_variant as string | null) ?? baseline?.ctaVariant ?? null,
    rightsExpiryAt: rightsExpiry,
    metrics: {
      renders,
      approvals,
      changesRequested,
      whatsappClicks,
      approvalRate,
      clickThroughRate: clickRate,
      costPerRender,
      score,
    },
    narrative: narrativeParts.join(' '),
    recommendedExperiments: experiments,
  };
}

function buildChallengerFromPrimary(primary: PlannerVariant): PlannerVariant {
  const boostedApproval = Math.min(primary.metrics.approvalRate * 1.05 + 0.015, 0.9);
  const boostedCtr = Math.min(primary.metrics.clickThroughRate * 1.08 + 0.02, 0.65);
  const reducedCost = primary.metrics.costPerRender != null
    ? Math.max(primary.metrics.costPerRender * 0.95, 0)
    : null;

  const experiments = new Set<string>(primary.recommendedExperiments);
  experiments.add('Introduce WhatsApp deep-link CTA to benchmark against control.');

  return {
    templateId: primary.templateId,
    templateLabel: primary.templateLabel ? `${primary.templateLabel} — CTA experiment` : null,
    hookId: primary.hookId,
    hookLabel: primary.hookLabel ? `${primary.hookLabel} (variant B)` : primary.hookLabel,
    scriptVersion: primary.scriptVersion,
    ctaVariant: primary.ctaVariant ? `${primary.ctaVariant} • WhatsApp push` : 'WhatsApp prompt CTA',
    rightsExpiryAt: primary.rightsExpiryAt,
    metrics: {
      renders: primary.metrics.renders,
      approvals: Math.round(primary.metrics.renders * boostedApproval),
      changesRequested: primary.metrics.changesRequested,
      whatsappClicks: Math.round(primary.metrics.renders * boostedCtr),
      approvalRate: boostedApproval,
      clickThroughRate: boostedCtr,
      costPerRender: reducedCost,
      score: primary.metrics.score + 5,
    },
    narrative: 'Leverages the control script with a stronger CTA and WhatsApp deep-link to probe retention uplift.',
    recommendedExperiments: Array.from(experiments),
  };
}

function buildRetrievalContext(entries: RowWithScore[]): string[] {
  const context = new Set<string>();
  for (const entry of entries) {
    const row = entry.row;
    const approvalRate = toRatio(row.approval_rate);
    const clickRate = toRatio(row.click_through_rate);
    context.add(`Slot ${row.slot}: approvals ${toNumber(row.approvals)}/${toNumber(row.renders)} (${formatPercent(approvalRate)})`);
    context.add(`CTR ${formatPercent(clickRate)} | Cost ${row.cost_per_render != null ? formatCurrency(row.cost_per_render, row.job?.render_currency ?? (row.metadata?.render_currency as string | null)) : 'n/a'} | Score ${entry.score.toFixed(2)}`);
    if (row.insights) {
      context.add(`Insight: ${row.insights}`);
    }
  }
  return Array.from(context);
}

function buildFallbackPlan(slots: string[], lookbackDays: number, source: 'synthetic'): ScriptPlannerResult {
  return {
    generatedAt: new Date().toISOString(),
    lookbackWindowDays: lookbackDays,
    source,
    slots: slots.map((slot, index) => buildFallbackSlot(slot, index)),
  };
}

function buildFallbackSlot(slot: string, seed = 0): PlannerSlotRecommendation {
  const baseApproval = 0.42 + (seed % 3) * 0.05;
  const baseCtr = 0.18 + (seed % 2) * 0.04;
  const primary: PlannerVariant = {
    templateId: null,
    templateLabel: `Baseline storyboard ${seed + 1}`,
    hookId: null,
    hookLabel: `Momentum hook ${seed + 1}`,
    scriptVersion: 'v1',
    ctaVariant: 'Book on WhatsApp',
    rightsExpiryAt: null,
    metrics: {
      renders: 48 + seed * 7,
      approvals: Math.round((48 + seed * 7) * baseApproval),
      changesRequested: Math.round((48 + seed * 7) * 0.08),
      whatsappClicks: Math.round((48 + seed * 7) * baseCtr),
      approvalRate: baseApproval,
      clickThroughRate: baseCtr,
      costPerRender: 2.4,
      score: baseApproval * 100 + baseCtr * 70,
    },
    narrative: 'Synthetic baseline assembled from playbook heuristics — prioritises approvals with steady WhatsApp taps.',
    recommendedExperiments: [
      'Swap final CTA to a limited-time incentive.',
      'Test alternate hook emphasising customer testimonial.',
    ],
  };

  const challenger = buildChallengerFromPrimary(primary);
  challenger.templateLabel = primary.templateLabel ? `${primary.templateLabel} alt` : challenger.templateLabel;

  return {
    slot,
    primary,
    challenger,
    retrievalContext: [
      'Synthetic data — connect to Supabase to unlock live analytics.',
      `Slot ${slot} baseline approval ${formatPercent(primary.metrics.approvalRate)}; CTR ${formatPercent(primary.metrics.clickThroughRate)}.`,
    ],
  };
}

function computeScore(row: PerformanceRow): number {
  const approvals = toNumber(row.approvals ?? row.job?.approvals_count);
  const renders = toNumber(row.renders ?? row.job?.renders);
  const approvalRate = toRatio(row.approval_rate);
  const clickRate = toRatio(row.click_through_rate);
  const cost = row.cost_per_render ?? 0;
  const daysAgo = daysBetween(row.interval_start, new Date().toISOString());
  const recencyBoost = daysAgo != null ? Math.max(0, 6 - daysAgo) : 0;

  return approvalRate * 70 + clickRate * 40 + approvals * 0.6 + recencyBoost * 3 - Math.min(cost, 25) * 4;
}

function toNumber(value: number | null | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function toRatio(value: number | null | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(value, 0);
  return fallback;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number, currency: string | null | undefined): string {
  const symbol = currencySymbol(currency);
  return `${symbol}${value.toFixed(2)}`;
}

function currencySymbol(currency: string | null | undefined): string {
  if (!currency) return '$';
  switch (currency.toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'RWF':
      return 'RWF ';
    case 'KES':
      return 'KES ';
    default:
      return `${currency.toUpperCase()} `;
  }
}

function daysUntil(value: string): number {
  const target = new Date(value);
  return Math.round((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function daysBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.abs(Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

export const scriptPlannerTool = {
  name: 'ScriptPlanner',
  description: 'Rank video templates/hooks using recent performance metrics and propose A/B variants per slot',
  parameters: scriptPlannerSchema,
  execute: executeScriptPlanner,
};
