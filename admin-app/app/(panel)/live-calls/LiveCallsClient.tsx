"use client";

import { useLiveCallsQuery } from "@/lib/queries/liveCalls";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveCallsTable } from "@/components/live-calls/LiveCallsTable";
import { Button } from "@/components/ui/Button";

export function LiveCallsClient() {
  const liveCallsQuery = useLiveCallsQuery();

  const summary = liveCallsQuery.data?.summary ?? {
    active: 0,
    handoff: 0,
    ended: 0,
  };

  const calls = liveCallsQuery.data?.calls ?? [];
  const integration = liveCallsQuery.data?.integration;

  return (
    <div className="admin-page">
      <PageHeader
        title="Live calls"
        description="Monitor active conversations, warm transfers, and opt-outs in real time."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => liveCallsQuery.refetch()}>
            Refresh
          </Button>
        }
      />

      <SectionCard
        title="Realtime overview"
        description="Counts update every few seconds. Handoffs indicate warm transfers in progress."
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[color:var(--color-surface)]/60 p-4 shadow-[var(--elevation-low)]">
            <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Active</dt>
            <dd className="text-2xl font-semibold text-[color:var(--color-foreground)]">{summary.active}</dd>
          </div>
          <div className="rounded-2xl bg-[color:var(--color-surface)]/60 p-4 shadow-[var(--elevation-low)]">
            <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Warm transfers</dt>
            <dd className="text-2xl font-semibold text-[color:var(--color-foreground)]">{summary.handoff}</dd>
          </div>
          <div className="rounded-2xl bg-[color:var(--color-surface)]/60 p-4 shadow-[var(--elevation-low)]">
            <dt className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Recently ended</dt>
            <dd className="text-2xl font-semibold text-[color:var(--color-foreground)]">{summary.ended}</dd>
          </div>
        </dl>
        {integration?.message && (
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">{integration.message}</p>
        )}
      </SectionCard>

      <SectionCard
        title="Call roster"
        description="Search by lead or phone number. Ended calls persist for a few minutes for auditing."
      >
        {liveCallsQuery.isLoading
          ? (
            <LoadingState
              title="Loading live calls"
              description="Fetching realtime session data from voice bridge."
            />
          )
          : calls.length
          ? <LiveCallsTable data={calls} />
          : (
            <EmptyState
              title="No calls yet"
              description="Live calls will appear here as soon as Twilio starts streaming audio."
            />
          )}
      </SectionCard>
    </div>
  );
}
