import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { TimeseriesChart } from '@/components/dashboard/TimeseriesChart';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderEventsList } from '@/components/orders/OrderEventsList';
import { WebhookErrorList } from '@/components/whatsapp/WebhookErrorList';
import { getDashboardSnapshot, listLatestOrderEvents, listLatestWebhookErrors } from '@/lib/data-provider';

export default async function DashboardPage() {
  const [{ kpis, timeseries }, orderEvents, webhookErrors] = await Promise.all([
    getDashboardSnapshot(),
    Promise.resolve(listLatestOrderEvents()),
    Promise.resolve(listLatestWebhookErrors())
  ]);

  return (
    <div className="dashboard-grid">
      <PageHeader
        title="Dashboard"
        description="Operations control centre with KPIs, service health, and quick insights. Real data will appear once Supabase credentials are configured."
      />
      <section aria-label="Key performance indicators" className="kpi-grid">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </section>
      <SectionCard
        title="Voucher activity"
        description="Issued vs redeemed vouchers over the last 14 days."
      >
        <TimeseriesChart data={timeseries} />
      </SectionCard>
      <SectionCard
        title="Latest order events"
        description="Stay ahead of vendor SLAs with the latest 10 events."
      >
        {orderEvents.length ? (
          <OrderEventsList events={orderEvents} />
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
        <WebhookErrorList errors={webhookErrors} />
      </SectionCard>
    </div>
  );
}
