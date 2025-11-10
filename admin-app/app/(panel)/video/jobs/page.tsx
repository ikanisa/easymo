import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassPanel } from "@/components/layout/GlassPanel";

export default function VideoJobsIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Video jobs"
        description="Track generated video requests and jump into detailed provenance dashboards."
      />
      <GlassPanel>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Workflow tips</h2>
          <p className="text-sm text-neutral-300">
            This surface focuses on detailed review. To inspect a specific job, paste its identifier into the URL as
            <code className="mx-2 rounded bg-neutral-900/50 px-2 py-1 text-xs">/video/jobs/&lt;job-id&gt;</code> or follow deep links from WhatsApp alerts.
          </p>
          <p className="text-sm text-neutral-300">
            Recently generated videos are available from the <Link className="text-sky-400 underline" href="/notifications">notifications feed</Link> and
            the automation log search.
          </p>
        </div>
      </GlassPanel>
    </div>
  );
}
