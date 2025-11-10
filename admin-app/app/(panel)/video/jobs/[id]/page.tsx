import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { getVideoJobDetail } from "@/lib/video/analytics";

const percentFormatter = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

interface VideoJobDetailPageProps {
  params: { id: string };
}

export default async function VideoJobDetailPage({ params }: VideoJobDetailPageProps) {
  const job = await getVideoJobDetail(params.id);
  if (!job) {
    notFound();
  }

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title={job.hookLabel ?? "Video job"}
        description={`Template ${job.templateLabel ?? 'unknown'} · Slot ${job.slot}`}
        meta={
          <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--color-muted)]">
            <span>Approvals {percentFormatter.format(job.metrics.approvalRate)}</span>
            <span>CTR {percentFormatter.format(job.metrics.clickThroughRate)}</span>
            {job.rightsExpiryAt ? (
              <span>Rights expire {formatDate(job.rightsExpiryAt)}</span>
            ) : null}
          </div>
        }
      />

      <SectionCard
        title="Current metrics"
        description="Aggregated stats for the job across the selected lookback window."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Renders" value={job.metrics.renders.toString()} />
          <Stat label="Approvals" value={job.metrics.approvals.toString()} />
          <Stat label="WhatsApp taps" value={job.metrics.whatsappClicks.toString()} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="Approval rate" value={percentFormatter.format(job.metrics.approvalRate)} />
          <Stat label="CTR" value={percentFormatter.format(job.metrics.clickThroughRate)} />
          <Stat
            label="Cost / render"
            value={formatCost(job.metrics.costPerRender, job.renderCurrency)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Insights" description="Highlights pulled from performance data.">
        {job.insights.length ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-[color:var(--color-foreground)]">
            {job.insights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--color-muted)]">No insights recorded yet.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Approval history"
        description="Reviews, approvals, and requested changes captured for this job."
      >
        {job.approvals.length ? (
          <div className="space-y-4">
            {job.approvals.map((approval) => (
              <div key={approval.id} className="rounded-xl border border-[color:var(--color-border)]/60 p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-[color:var(--color-foreground)]">
                    {approval.reviewerName ?? 'Reviewer'}
                  </span>
                  <span className="rounded-full bg-[color:var(--color-border)]/40 px-2 py-0.5 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                    {approval.status}
                  </span>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {formatDateTime(approval.createdAt)}
                  </span>
                </div>
                {approval.summary ? (
                  <p className="mt-2 text-sm text-[color:var(--color-foreground)]">{approval.summary}</p>
                ) : null}
                {approval.requestedChanges ? (
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    Requested changes: {approval.requestedChanges}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--color-muted)]">
                  <span>WhatsApp taps {approval.whatsappClicks}</span>
                  {approval.approvedAt ? <span>Approved {formatDateTime(approval.approvedAt)}</span> : null}
                  {approval.changesRequestedAt ? (
                    <span>Changes requested {formatDateTime(approval.changesRequestedAt)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--color-muted)]">No approval records found.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Performance windows"
        description="Daily, weekly, and lifetime metrics captured for this job."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--color-border)]/50 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="py-2 pr-4">Interval</th>
                <th className="py-2 pr-4">Start</th>
                <th className="py-2 pr-4">Renders</th>
                <th className="py-2 pr-4">Approvals</th>
                <th className="py-2 pr-4">Approval rate</th>
                <th className="py-2 pr-4">CTR</th>
                <th className="py-2 pr-4">Cost/render</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]/40 text-[color:var(--color-foreground)]">
              {job.performance.map((row) => (
                <tr key={`${row.interval}-${row.intervalStart}`}>
                  <td className="py-2 pr-4 capitalize">{row.interval}</td>
                  <td className="py-2 pr-4">{formatDate(row.intervalStart)}</td>
                  <td className="py-2 pr-4">{row.renders}</td>
                  <td className="py-2 pr-4">{row.approvals}</td>
                  <td className="py-2 pr-4">{percentFormatter.format(row.approvalRate)}</td>
                  <td className="py-2 pr-4">{percentFormatter.format(row.clickThroughRate)}</td>
                  <td className="py-2 pr-4">{formatCost(row.costPerRender, job.renderCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)] p-4">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-2 text-xl font-semibold text-[color:var(--color-foreground)]">{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatCost(value: number | null, currency: string | null): string {
  if (value == null) return 'N/A';
  const safeCurrency = currency ?? 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}
