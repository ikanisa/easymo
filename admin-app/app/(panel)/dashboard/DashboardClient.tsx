"use client";

import { Fragment } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TimeseriesChart } from "@/components/dashboard/TimeseriesChart";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderEventsList } from "@/components/orders/OrderEventsList";
import { WebhookErrorList } from "@/components/whatsapp/WebhookErrorList";
import {
  useDashboardOrderEventsQuery,
  useDashboardSnapshotQuery,
  useDashboardWebhookErrorsQuery,
} from "@/lib/queries/dashboard";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAdminHubSnapshotQuery } from "@/lib/queries/adminHub";
import { AdminHubSectionGrid } from "@/components/dashboard/AdminHubSectionGrid";
import { AdminDiagnosticsCard } from "@/components/dashboard/AdminDiagnosticsCard";

export function DashboardClient() {
  const snapshotQuery = useDashboardSnapshotQuery();
  const orderEventsQuery = useDashboardOrderEventsQuery();
  const webhookErrorsQuery = useDashboardWebhookErrorsQuery();
  const adminHubQuery = useAdminHubSnapshotQuery();

  if (snapshotQuery.isLoading) {
    return (
      <LoadingState
        title="Loading dashboard"
        description="Fetching the latest KPIs and service telemetry."
      />
    );
  }

  const snapshotResult = snapshotQuery.data;
  const snapshot = snapshotResult?.data ?? { kpis: [], timeseries: [] };
  const orderEvents = orderEventsQuery.data ?? [];
  const webhookErrors = webhookErrorsQuery.data ?? [];
  const adminHub = adminHubQuery.data;
  const integrationNotice = snapshotResult?.integration;
  const dashboardDescription = integrationNotice?.status === "degraded"
    ? "Live KPIs are unavailable until Supabase credentials are configured."
    : "Operations control centre with KPIs, service health, and quick insights.";

  return (
    <div className="dashboard-grid space-y-6">
      <PageHeader
        title="Dashboard"
        description={dashboardDescription}
      />
      {integrationNotice?.status === "degraded" && (
        <div
          className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-sm text-amber-900"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Dashboard is using fallback data.</p>
          {integrationNotice.message && (
            <p className="mt-2">{integrationNotice.message}</p>
          )}
          {integrationNotice.remediation && (
            <p className="mt-3 font-medium">
              Remediation: {integrationNotice.remediation} Refer to docs/PHASE0_CREDENTIAL_CHECKLIST.md for the full credential matrix.
            </p>
          )}
        </div>
      )}
      <SectionCard
        title="Admin hub quick links"
        description="Surface the WhatsApp admin hub sections that the flow-exchange bridge currently exposes. Configure ADMIN_FLOW_WA_ID to hydrate live data."
      >
        {adminHub
          ? (
            <AdminHubSectionGrid
              sections={adminHub.sections}
              messages={adminHub.messages}
            />
          )
          : adminHubQuery.isLoading
          ? (
            <LoadingState
              title="Loading admin hub sections"
              description="Fetching live hub definitions via flow-exchange."
            />
          )
          : (
            <EmptyState
              title="Admin hub unavailable"
              description="We could not load admin hub sections. Check the flow-exchange bridge configuration."
            />
          )}
      </SectionCard>
      <AdminDiagnosticsCard />
      <section
        aria-label="Key performance indicators"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {snapshot.kpis.length
          ? (
            snapshot.kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)
          )
          : (
            <Fragment>
              <LoadingState
                title="KPIs unavailable"
                description="We will surface KPIs once data sources initialise."
              />
            </Fragment>
          )}
      </section>
      <SectionCard
        title="Voucher activity"
        description="Issued vs redeemed vouchers over the last 14 days."
      >
        <TimeseriesChart data={snapshot.timeseries} />
      </SectionCard>
      <SectionCard
        title="Latest order events"
        description="Stay ahead of vendor SLAs with the latest 10 events."
      >
        {orderEvents.length
          ? <OrderEventsList events={orderEvents} />
          : orderEventsQuery.isLoading
          ? (
            <LoadingState
              title="Loading order events"
              description="Pulling recent events."
            />
          )
          : (
            <EmptyState
              title="No order events"
              description="Events will appear here once orders start flowing."
            />
          )}
      </SectionCard>
      <SectionCard
        title="Latest webhook errors"
        description="Failed webhooks bubble up here so you can retry quickly."
      >
        {webhookErrors.length
          ? <WebhookErrorList errors={webhookErrors} />
          : webhookErrorsQuery.isLoading
          ? (
            <LoadingState
              title="Loading webhook errors"
              description="Gathering latest failures."
            />
          )
          : (
            <EmptyState
              title="No webhook errors"
              description="You are all clear — no delivery errors detected."
            />
          )}
      </SectionCard>
    </div>
  );
}
