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
