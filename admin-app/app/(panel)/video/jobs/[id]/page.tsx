import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassPanel } from "@/components/layout/GlassPanel";
import { loadVideoJobDetail } from "@/lib/server/video-jobs";

interface PageProps {
  params: { id: string };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default async function VideoJobDetailPage({ params }: PageProps) {
  const job = await loadVideoJobDetail(params.id);
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

  const references = job.shotplan?.references ?? {};
  const products = references.products ?? [];
  const guides = references.brand_guides ?? [];
  const shots = job.shotplan?.shots ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Video job ${job.id}`}
        description="Inspect the prompts, assets, and outputs that power generated WhatsApp-ready videos."
        meta={<span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{job.status}</span>}
      />

      <GlassPanel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-neutral-400">Queue status</p>
            <p className="text-lg font-semibold">{job.queueStatus}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-400">WhatsApp send</p>
            <p className="text-lg font-semibold">{job.whatsappStatus}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-400">Template</p>
            <p className="text-lg font-semibold">{job.script?.templateTitle ?? job.script?.templateSlug ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-400">Locale</p>
            <p className="text-lg font-semibold">{job.script?.locale ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-400">Created</p>
            <p className="text-lg font-semibold">{formatDate(job.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-400">Updated</p>
            <p className="text-lg font-semibold">{formatDate(job.updatedAt)}</p>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Lineage</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">Prompt synopsis</h3>
              <p className="rounded-lg bg-neutral-900/40 p-4 text-sm leading-relaxed text-neutral-100">
                {job.shotplan?.synopsis ?? job.script?.synopsis ?? "No synopsis captured for this script."}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">Voice</h3>
              <p className="rounded-lg bg-neutral-900/40 p-4 text-sm text-neutral-100">
                {job.shotplan?.voice ?? "Not specified"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">Brand guides</h3>
              <ul className="space-y-2 text-sm">
                {guides.length === 0
                  ? <li className="rounded-lg bg-neutral-900/40 px-4 py-3 text-neutral-300">No brand guides referenced.</li>
                  : guides.map((guide) => (
                    <li key={guide.id} className="rounded-lg bg-neutral-900/40 px-4 py-3">
                      <p className="font-medium text-neutral-100">{guide.title ?? guide.id}</p>
                      {guide.summary
                        ? <p className="text-neutral-400">{guide.summary}</p>
                        : null}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">Products</h3>
              <ul className="space-y-2 text-sm">
                {products.length === 0
                  ? <li className="rounded-lg bg-neutral-900/40 px-4 py-3 text-neutral-300">No product assets referenced.</li>
                  : products.map((product) => (
                    <li key={product.id} className="rounded-lg bg-neutral-900/40 px-4 py-3">
                      <p className="font-medium text-neutral-100">{product.name ?? product.id}</p>
                      {product.description
                        ? <p className="text-neutral-400">{product.description}</p>
                        : null}
                      {product.hero_asset_url
                        ? (
                          <p className="text-neutral-500">
                            Hero asset: <Link href={product.hero_asset_url} className="text-sky-400 underline">{product.hero_asset_url}</Link>
                          </p>
                        )
                        : null}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Shot plan</h2>
          {shots.length === 0
            ? <p className="text-sm text-neutral-300">Shot plan has not been generated for this job yet.</p>
            : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-800 text-sm">
                  <thead className="bg-neutral-900/60 text-neutral-300">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">#</th>
                      <th className="px-4 py-2 text-left font-medium">Visual prompt</th>
                      <th className="px-4 py-2 text-left font-medium">Voiceover</th>
                      <th className="px-4 py-2 text-left font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/60">
                    {shots.map((shot) => (
                      <tr key={shot.order} className="align-top">
                        <td className="px-4 py-3 font-semibold text-neutral-100">{shot.order}</td>
                        <td className="px-4 py-3 text-neutral-100">{shot.prompt}</td>
                        <td className="px-4 py-3 text-neutral-300">{shot.voiceover}</td>
                        <td className="px-4 py-3 text-neutral-300">{shot.duration_seconds}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Outputs</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-neutral-900/40 p-4">
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">Master (1080p)</h3>
              <p className="mt-2 break-all text-sm text-neutral-100">{job.masterPath ?? "Not yet stored"}</p>
              {job.masterSignedUrl
                ? <Link href={job.masterSignedUrl} className="mt-3 inline-flex items-center text-sm font-semibold text-sky-400 underline">Download master</Link>
                : null}
            </div>
            <div className="rounded-xl bg-neutral-900/40 p-4">
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">WhatsApp rendition</h3>
              <p className="mt-2 break-all text-sm text-neutral-100">{job.whatsappPath ?? "Not yet stored"}</p>
              {job.whatsappSignedUrl
                ? <Link href={job.whatsappSignedUrl} className="mt-3 inline-flex items-center text-sm font-semibold text-sky-400 underline">Download WhatsApp file</Link>
                : null}
              <p className="mt-2 text-xs text-neutral-500">Status: {job.whatsappStatus}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm uppercase tracking-wide text-neutral-400">Provenance</h3>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-neutral-900/60 p-4 text-xs text-neutral-200">
              {JSON.stringify(job.provenance ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
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
