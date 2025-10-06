"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { useLogsQuery } from "@/lib/queries/logs";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";

export function LogsClient() {
  const { data, isLoading, isError } = useLogsQuery();
  const [actorFilter, setActorFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [auditLimit, setAuditLimit] = useState(20);
  const [eventLimit, setEventLimit] = useState(20);

  const filteredAudit = useMemo(() => {
    const audit = data?.audit ?? [];
    return audit.filter((entry) => {
      const actorMatch = actorFilter
        ? entry.actor.toLowerCase().includes(actorFilter.toLowerCase())
        : true;
      const targetMatch = targetFilter
        ? `${entry.target_table}/${entry.target_id}`.toLowerCase().includes(
          targetFilter.toLowerCase(),
        )
        : true;
      return actorMatch && targetMatch;
    });
  }, [actorFilter, targetFilter, data?.audit]);

  const voucherEvents = useMemo(() => data?.events ?? [], [data?.events]);

  useEffect(() => {
    setAuditLimit(20);
  }, [actorFilter, targetFilter, data?.audit]);

  useEffect(() => {
    setEventLimit(20);
  }, [data?.events]);

  const slicedAudit = useMemo(
    () => filteredAudit.slice(0, auditLimit),
    [filteredAudit, auditLimit],
  );

  const slicedEvents = useMemo(
    () => voucherEvents.slice(0, eventLimit),
    [voucherEvents, eventLimit],
  );

  if (isLoading) {
    return (
      <LoadingState
        title="Loading logs"
        description="Fetching latest audit and voucher events."
      />
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Unable to load logs"
        description="Check your network connection or verify the /api/logs route."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.integration
        ? (
          <IntegrationStatusBadge
            integration={data.integration}
            label="Logs source"
          />
        )
        : null}
      <SectionCard
        title="Audit log"
        description="Recent actions across the admin panel."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--color-muted)]">Actor</span>
            <input
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value)}
              placeholder="e.g. admin"
              className="rounded-xl border border-[color:var(--color-border)]/50 bg-white/80 px-4 py-2 text-[color:var(--color-foreground)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[color:var(--color-muted)]">Target</span>
            <input
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
              placeholder="e.g. vouchers"
              className="rounded-xl border border-[color:var(--color-border)]/50 bg-white/80 px-4 py-2 text-[color:var(--color-foreground)]"
            />
          </label>
        </div>
        {slicedAudit.length
          ? (
            <ul className="mt-6 space-y-3 text-sm">
              {slicedAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-3"
                >
                  <strong className="text-[color:var(--color-foreground)]">
                    {entry.action}
                  </strong>{" "}
                  by <span className="font-medium">{entry.actor}</span> on{" "}
                  <span className="font-mono text-xs text-[color:var(--color-muted)]">
                    {entry.target_table}/{entry.target_id}
                  </span>{" "}
                  – {new Date(entry.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          )
          : (
            <EmptyState
              title="No matching audit entries"
              description="Adjust the filters to see more results."
            />
          )}
        <LoadMoreButton
          hasMore={filteredAudit.length > slicedAudit.length}
          onClick={() => setAuditLimit((current) => current + 20)}
          loading={false}
        >
          Load more audit entries
        </LoadMoreButton>
      </SectionCard>

      <SectionCard
        title="Voucher events"
        description="Recent order events (mock)."
      >
        {slicedEvents.length
          ? (
            <ul className="space-y-2 text-sm">
              {slicedEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/50 px-4 py-3"
                >
                  <strong className="text-[color:var(--color-foreground)]">
                    {event.orderId}
                  </strong>{" "}
                  – {event.type} – {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )
          : (
            <EmptyState
              title="No voucher events"
              description="Voucher events will populate once Supabase data is connected."
            />
          )}
        <LoadMoreButton
          hasMore={voucherEvents.length > slicedEvents.length}
          onClick={() => setEventLimit((current) => current + 20)}
          loading={false}
        >
          Load more events
        </LoadMoreButton>
      </SectionCard>
    </div>
  );
}
