"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { VoiceCallsTable } from "./VoiceCallsTable";
import { VoiceFollowupsTable } from "./VoiceFollowupsTable";
import { VoiceStatsSummary } from "./VoiceStatsSummary";
import { VoiceFilters, type VoiceFilterState } from "./VoiceFilters";
import { useVoiceAnalyticsQuery } from "@/lib/queries/voiceAnalytics";
import { getAdminApiRoutePath } from "@/lib/routes";

export function VoiceAnalyticsPage() {
  const [filters, setFilters] = useState<VoiceFilterState>({});
  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (filters.status) searchParams.set("status", filters.status);
    if (filters.channel) searchParams.set("channel", filters.channel);
    if (filters.from) searchParams.set("from", filters.from.toISOString());
    if (filters.to) searchParams.set("to", filters.to.toISOString());
    if (filters.search) searchParams.set("search", filters.search.trim());
    return searchParams;
  }, [filters]);

  const analytics = useVoiceAnalyticsQuery(params);
  const downloadUrl = useMemo(() => {
    const query = params.toString();
    return `${getAdminApiRoutePath("voiceAnalyticsExport")}${query ? `?${query}` : ""}`;
  }, [params]);
  const calls = analytics.data?.calls ?? [];
  const followups = analytics.data?.followups ?? [];
  const stats = analytics.data?.stats ?? null;

  return (
    <div className="admin-page">
      <PageHeader
        title="Voice analytics"
        description="Review WhatsApp call activity, follow-ups, and agent outcomes across tenants."
        meta={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void analytics.refetch()}>
              Refresh
            </Button>
            <Button asChild type="button" variant="ghost" size="sm">
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                Download CSV
              </a>
            </Button>
          </div>
        }
      />

      <SectionCard title="Filters" description="Adjust date range, outcome, or channel.">
        <VoiceFilters value={filters} onChange={setFilters} />
      </SectionCard>

      {analytics.error && (
        <SectionCard title="Error" description="">
          <EmptyState
            title="Unable to load voice analytics"
            description={(analytics.error as Error).message}
          />
        </SectionCard>
      )}

      {analytics.isLoading
        ? (
          <LoadingState title="Loading voice analytics" description="Fetching data from voice bridge" />
        )
        : (
          <>
            <VoiceStatsSummary stats={stats} />

            <SectionCard
              title="Calls"
              description="Completed, failed, and in-progress calls across the selected range."
            >
              {calls.length
                ? <VoiceCallsTable data={calls} />
                : (
                  <EmptyState
                    title="No calls"
                    description="Adjust filters or verify voice gateway activity."
                  />
                )}
            </SectionCard>

            <SectionCard
              title="Scheduled follow-ups"
              description="Follow-up actions captured by the agent tooling."
            >
              {followups.length
                ? <VoiceFollowupsTable data={followups} />
                : (
                  <EmptyState
                    title="No follow-ups"
                    description="Calls can schedule follow-ups via the agent."
                  />
                )}
            </SectionCard>
          </>
        )}
    </div>
  );
}
