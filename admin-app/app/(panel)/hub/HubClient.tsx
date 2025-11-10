"use client";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminDiagnosticsCard } from "@/components/dashboard/AdminDiagnosticsCard";
import { AdminHubSectionGrid } from "@/components/dashboard/AdminHubSectionGrid";
import { useAdminHubSnapshotQuery } from "@/lib/queries/adminHub";

export function HubClient() {
  const adminHubQuery = useAdminHubSnapshotQuery({
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const snapshot = adminHubQuery.data;

  return (
    <div className="hub-page space-y-6">
      <PageHeader
        title="Admin hub"
        description="Glassmorphic control surface that unifies WhatsApp orchestration, live operations, and diagnostics."
      />
      <SectionCard
        title="Hub sections"
        description="Omnisearch and quick actions pull from the latest flow-exchange snapshot."
      >
        {snapshot ? (
          <AdminHubSectionGrid sections={snapshot.sections} messages={snapshot.messages} />
        ) : adminHubQuery.isLoading ? (
          <LoadingState
            title="Loading admin hub"
            description="Fetching live hub definitions and seeded quick actions."
          />
        ) : (
          <EmptyState
            title="Admin hub unavailable"
            description="We could not load hub sections. Confirm the flow-exchange bridge credentials."
          />
        )}
      </SectionCard>
      <AdminDiagnosticsCard />
      <SectionCard
        title="Operational notes"
        description="Track what changed and why. Use these notes to coordinate handoffs between automation and human ops."
      >
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          Coming soon: shared timelines from integrations, live traffic, and staffed overrides. For now, continue to monitor the
          dashboard for webhook failures and agent escalations.
        </p>
      </SectionCard>
    </div>
  );
}
