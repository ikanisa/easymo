"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { NotificationsTable } from "@/components/notifications/NotificationsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type NotificationsQueryParams,
  useNotificationsQuery,
} from "@/lib/queries/notifications";

const STATUS_FILTERS = ["queued", "sent", "failed"] as const;

interface NotificationsClientProps {
  initialParams?: NotificationsQueryParams;
}

export function NotificationsClient(
  { initialParams = { limit: 200 } }: NotificationsClientProps,
) {
  const [params, setParams] = useState<NotificationsQueryParams>(initialParams);
  const notificationsQuery = useNotificationsQuery(params);

  const notifications = useMemo(() => notificationsQuery.data?.data ?? [], [
    notificationsQuery.data?.data,
  ]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    notifications.forEach((item) => {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    });
    return counts;
  }, [notifications]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Notifications"
        description="Monitor WhatsApp send status and manage resends or cancellations."
      />
      <SectionCard
        title="Outbox"
        description="Resend or cancel notifications. Actions persist when Supabase credentials are present."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[color:var(--color-muted)]">
              Status
              <select
                value={params.status ?? ""}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    status: event.target.value || undefined,
                  }))}
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              >
                <option value="">All</option>
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        {notificationsQuery.isLoading
          ? (
            <LoadingState
              title="Loading notifications"
              description="Fetching latest outbox entries."
            />
          )
          : notifications.length
          ? <NotificationsTable initialData={notifications} />
          : (
            <EmptyState
              title="Outbox empty"
              description="No notifications yet. Activities will appear once Supabase data is connected."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Status summary"
        description="Counts by status to highlight potential delivery issues."
      >
        {notifications.length
          ? (
            <ul className="grid gap-3 md:grid-cols-3">
              {STATUS_FILTERS.map((status) => (
                <li
                  key={status}
                  className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4 text-sm"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                    {status}
                  </div>
                  <div className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                    {statusCounts.get(status) ?? 0}
                  </div>
                </li>
              ))}
            </ul>
          )
          : (
            <EmptyState
              title="No data"
              description="Counts will display once notifications flow."
            />
          )}
      </SectionCard>
    </div>
  );
}
