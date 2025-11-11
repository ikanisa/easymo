"use client";

import { Fragment } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { WebhookErrorList } from "@/components/whatsapp/WebhookErrorList";
import {
  useDashboardSnapshotQuery,
  useDashboardWebhookErrorsQuery,
} from "@/lib/queries/dashboard";
import { LoadingState } from "@/components/ui/LoadingState";
import { useAdminHubSnapshotQuery } from "@/lib/queries/adminHub";
import { AdminHubSectionGrid } from "@/components/dashboard/AdminHubSectionGrid";
import { AdminDiagnosticsCard } from "@/components/dashboard/AdminDiagnosticsCard";

export function DashboardClient() {
  const snapshotQuery = useDashboardSnapshotQuery();
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
        title="Quick Actions"
        description="Access key administrative tools and system diagnostics"
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
              title="Loading quick actions"
              description="Fetching available administrative tools"
            />
          )
          : (
            <EmptyState
              title="Quick actions unavailable"
              description="Administrative tools could not be loaded. Please refresh the page or contact support if the issue persists."
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
