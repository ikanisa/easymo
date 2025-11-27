"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { WebhookErrorList } from "@/components/whatsapp/WebhookErrorList";
import { useDashboardWebhookErrorsQuery } from "@/lib/queries/dashboard";
import {
  type NotificationsQueryParams,
  useNotificationsQuery,
} from "@/lib/queries/notifications";

interface WhatsAppHealthClientProps {
  initialNotificationParams?: NotificationsQueryParams;
}

export function WhatsAppHealthClient(
  { initialNotificationParams = { limit: 200 } }: WhatsAppHealthClientProps,
) {
  const [params] = useState(initialNotificationParams);
  const notificationsQuery = useNotificationsQuery(params);
  const webhookErrorsQuery = useDashboardWebhookErrorsQuery();

  const notifications = useMemo(() => notificationsQuery.data?.data ?? [], [
    notificationsQuery.data?.data,
  ]);

  const { total, failureCount, queuedCount, successRate } =
    useMemo(() => {
      if (!notifications.length) {
        return {
          total: 0,
          failureCount: 0,
          queuedCount: 0,
          successRate: "—",
        };
      }
      const total = notifications.length;
      const success = notifications.filter((n) => n.status === "sent").length;
      const failure = notifications.filter((n) => n.status === "failed").length;
      const queued = notifications.filter((n) => n.status === "queued").length;
      const rate = total ? ((success / total) * 100).toFixed(1) : "—";
      return {
        total,
        failureCount: failure,
        queuedCount: queued,
        successRate: rate,
      };
    }, [notifications]);

  return (
    <div className="admin-page">
      <PageHeader
        title="WhatsApp Health"
        description="Track delivery performance, webhook status, and pending retries across flows and automations."
      />

      <SectionCard
        title="Delivery overview"
        description="High-level stats from the notification outbox."
      >
        {notificationsQuery.isLoading
          ? (
            <LoadingState
              title="Loading notifications"
              description="Calculating delivery metrics."
            />
          )
          : total
          ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4">
                <strong className="text-sm text-[color:var(--color-muted)]">
                  Success rate
                </strong>
                <p className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                  {successRate}%
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4">
                <strong className="text-sm text-[color:var(--color-muted)]">
                  Queued
                </strong>
                <p className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                  {queuedCount}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4">
                <strong className="text-sm text-[color:var(--color-muted)]">
                  Failed
                </strong>
                <p className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                  {failureCount}
                </p>
              </div>
            </div>
          )
          : (
            <EmptyState
              title="No notifications yet"
              description="Delivery metrics populate once messages are sent."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Recent webhook errors"
        description="Retry failed webhooks before they impact customer flows."
      >
        {webhookErrorsQuery.isLoading
          ? (
            <LoadingState
              title="Loading webhook errors"
              description="Fetching latest webhook failures."
            />
          )
          : <WebhookErrorList errors={webhookErrorsQuery.data ?? []} />}
      </SectionCard>

      <SectionCard
        title="Retry queue"
        description="Pending sends and retry actions will surface in this section once APIs are available."
      >
        <EmptyState
          title="Retry controls pending"
          description="EF bridges will populate and control the retry queue in later phases."
        />
      </SectionCard>
    </div>
  );
}
