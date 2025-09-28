'use client';

import { Fragment } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { TimeseriesChart } from '@/components/dashboard/TimeseriesChart';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderEventsList } from '@/components/orders/OrderEventsList';
import { WebhookErrorList } from '@/components/whatsapp/WebhookErrorList';
import {
  useDashboardSnapshotQuery,
  useDashboardOrderEventsQuery,
  useDashboardWebhookErrorsQuery
} from '@/lib/queries/dashboard';
import { LoadingState } from '@/components/ui/LoadingState';

export function DashboardClient() {
  const snapshotQuery = useDashboardSnapshotQuery();
  const orderEventsQuery = useDashboardOrderEventsQuery();
  const webhookErrorsQuery = useDashboardWebhookErrorsQuery();

  if (snapshotQuery.isLoading) {
    return (
      <LoadingState
        title="Loading dashboard"
        description="Fetching the latest KPIs and service telemetry."
      />
    );
  }

  const snapshot = snapshotQuery.data ?? { kpis: [], timeseries: [] };
  const orderEvents = orderEventsQuery.data ?? [];
  const webhookErrors = webhookErrorsQuery.data ?? [];

  return (
    <div className="dashboard-grid space-y-6">
      <PageHeader
        title="Dashboard"
        description="Operations control centre with KPIs, service health, and quick insights. Real data will appear once Supabase credentials are configured."
      />
      <section aria-label="Key performance indicators" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.kpis.length ? (
          snapshot.kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)
        ) : (
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
        {orderEvents.length ? (
          <OrderEventsList events={orderEvents} />
        ) : orderEventsQuery.isLoading ? (
          <LoadingState title="Loading order events" description="Pulling recent events." />
        ) : (
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
        {webhookErrors.length ? (
          <WebhookErrorList errors={webhookErrors} />
        ) : webhookErrorsQuery.isLoading ? (
          <LoadingState title="Loading webhook errors" description="Gathering latest failures." />
        ) : (
          <EmptyState
            title="No webhook errors"
            description="You are all clear — no delivery errors detected."
          />
        )}
      </SectionCard>
    </div>
  );
}
