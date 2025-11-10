"use client";

import Link from "next/link";
import { SparklineChart } from "@easymo/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import type { VideoAnalyticsDashboardData } from "@/lib/video/analytics";

interface VideoAnalyticsDashboardProps {
  data: VideoAnalyticsDashboardData;
}

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const fallbackCurrencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function VideoAnalyticsDashboard({ data }: VideoAnalyticsDashboardProps) {
  const totals = data.totals;

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="Video analytics"
        description="Monitor hook retention, CTA performance, and cost-per-render for campaign footage."
        meta={
          <div className="flex items-center gap-3 text-sm text-[color:var(--color-muted)]">
            <span>{data.lookbackDays}-day lookback</span>
            {data.lastRefreshedAt ? (
              <span>Last refreshed {formatRelativeTime(data.lastRefreshedAt)}</span>
            ) : null}
          </div>
        }
      />

      {data.isSample ? (
        <SectionCard
          title="Sample dataset"
          description="Connect the admin app to Supabase to view live performance metrics."
          muted
        >
          <p className="text-sm text-[color:var(--color-muted)]">
            The analytics below use seeded reference data so the dashboard remains functional without a database connection.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Top-line metrics"
        description="Roll-up of renders, approvals, and WhatsApp engagement across the selected window."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Renders" value={numberFormatter.format(totals.renders)} subtitle="Videos rendered" />
          <MetricCard
            label="Approvals"
            value={numberFormatter.format(totals.approvals)}
            subtitle={`Approval rate ${percentFormatter.format(totals.approvalRate)}`}
          />
          <MetricCard
            label="WhatsApp taps"
            value={numberFormatter.format(totals.whatsappClicks)}
            subtitle={`CTR ${percentFormatter.format(totals.clickThroughRate)}`}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Change requests"
            value={numberFormatter.format(totals.changesRequested)}
            subtitle="Requests logged via approvals"
          />
          <MetricCard
            label="Avg cost / render"
            value={totals.averageCostPerRender != null
              ? fallbackCurrencyFormatter.format(totals.averageCostPerRender)
              : "N/A"}
            subtitle="Based on render cost submissions"
          />
          <MetricCard
            label="Lookback"
            value={`${data.lookbackDays} days`}
            subtitle="Adjust via query params if needed"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Hook retention"
        description="Approval rate trend plus the highest performing hooks in the selected window."
      >
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <SparklineChart
            aria-label="Hook approval rate trend"
            data={data.retentionTimeline.map((point) => ({ label: point.label, value: point.value }))}
            description="Average approval rate across all hooks"
          />
          <div className="flex flex-col gap-3">
            {data.hookLeaders.map((leader) => (
              <div key={leader.jobId} className="rounded-xl border border-[color:var(--color-border)]/60 p-4">
                <div className="text-sm font-semibold text-[color:var(--color-foreground)]">
                  {leader.hookLabel}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  Slot {leader.slot} · {leader.templateLabel ?? "Unknown template"}
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span>Approval {percentFormatter.format(leader.approvalRate)}</span>
                  <span>CTR {percentFormatter.format(leader.clickThroughRate)}</span>
                </div>
                {leader.costPerRender != null ? (
                  <div className="mt-2 text-xs text-[color:var(--color-muted)]">
                    Cost/render {fallbackCurrencyFormatter.format(leader.costPerRender)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="CTA effectiveness"
        description="WhatsApp click-through rate grouped by CTA variant."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--color-border)]/50 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="py-2 pr-4">CTA variant</th>
                <th className="py-2 pr-4">CTR</th>
                <th className="py-2 pr-4">Approvals</th>
                <th className="py-2 pr-4">Renders</th>
                <th className="py-2 pr-4">WhatsApp taps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]/40 text-[color:var(--color-foreground)]">
              {data.ctaEffectiveness.map((cta) => (
                <tr key={cta.ctaVariant}>
                  <td className="py-2 pr-4 font-medium">{cta.ctaVariant}</td>
                  <td className="py-2 pr-4">{percentFormatter.format(cta.clickRate)}</td>
                  <td className="py-2 pr-4">{numberFormatter.format(cta.approvals)}</td>
                  <td className="py-2 pr-4">{numberFormatter.format(cta.renders)}</td>
                  <td className="py-2 pr-4">{numberFormatter.format(cta.whatsappClicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Cost per render"
        description="Average render cost over time to monitor spend efficiency."
      >
        <SparklineChart
          aria-label="Average cost per render"
          data={data.costPerRenderTimeline.map((point) => ({ label: point.label, value: point.value }))}
          description="Daily average cost per render"
        />
      </SectionCard>

      <SectionCard
        title="Job lineage"
        description="Trace jobs back to approvals and rights windows."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--color-border)]/50 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="py-2 pr-4">Hook</th>
                <th className="py-2 pr-4">Slot</th>
                <th className="py-2 pr-4">Approvals</th>
                <th className="py-2 pr-4">CTR</th>
                <th className="py-2 pr-4">Cost/render</th>
                <th className="py-2 pr-4">Rights expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]/40 text-[color:var(--color-foreground)]">
              {data.jobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-3 pr-4 font-medium">
                    <Link
                      className="text-[color:var(--color-accent)] hover:underline"
                      href={`/video/jobs/${job.id}`}
                    >
                      {job.hookLabel ?? 'Untitled hook'}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{job.slot}</td>
                  <td className="py-3 pr-4">{percentFormatter.format(job.metrics.approvalRate)}</td>
                  <td className="py-3 pr-4">{percentFormatter.format(job.metrics.clickThroughRate)}</td>
                  <td className="py-3 pr-4">
                    {job.metrics.costPerRender != null
                      ? formatCurrencyValue(job.metrics.costPerRender, job.renderCurrency)
                      : 'N/A'}
                  </td>
                  <td className="py-3 pr-4">{formatExpiry(job.rightsExpiryAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.rightsExpiring.length ? (
          <div className="mt-6 rounded-xl bg-[color:var(--color-border)]/20 p-4">
            <h3 className="text-sm font-semibold text-[color:var(--color-foreground)]">
              Rights expiring soon
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
              {data.rightsExpiring.map((entry) => (
                <li key={entry.jobId}>
                  <span className="font-medium text-[color:var(--color-foreground)]">
                    {entry.hookLabel}
                  </span>{' '}
                  ({entry.slot}) · expires in {entry.daysRemaining} day{entry.daysRemaining === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
}

function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)] p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[color:var(--color-foreground)]">{value}</div>
      {subtitle ? (
        <div className="mt-1 text-xs text-[color:var(--color-muted)]">{subtitle}</div>
      ) : null}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / (60 * 1000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatExpiry(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatCurrencyValue(value: number, currency: string | null | undefined): string {
  if (!currency) return fallbackCurrencyFormatter.format(value);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return fallbackCurrencyFormatter.format(value);
  }
}
