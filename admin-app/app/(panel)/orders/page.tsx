import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { OrdersClient } from '@/components/orders/OrdersClient';
import { OrderEventsList } from '@/components/orders/OrderEventsList';
import { listOrders, listLatestOrderEvents } from '@/lib/data-provider';

export default async function OrdersPage() {
  const [{ data: orders }] = await Promise.all([listOrders({ limit: 200 })]);
  const recentEvents = listLatestOrderEvents();

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Orders"
        description="Monitor order lifecycle, nudge vendors, and execute policy-controlled overrides."
      />

      <SectionCard
        title="Live orders"
        description="Use overrides to cancel, nudge, or reopen orders. Policies will govern availability once Supabase data is wired."
      >
        <OrdersClient orders={orders} />
      </SectionCard>

      <SectionCard
        title="Latest events"
        description="Quick view of the last 10 order events to help triage issues."
      >
        <OrderEventsList events={recentEvents} />
      </SectionCard>
    </div>
  );
}
