import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { NotificationsTable } from '@/components/notifications/NotificationsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { listNotifications } from '@/lib/data-provider';

export default async function NotificationsPage() {
  const { data } = await listNotifications({ limit: 200 });

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Notifications"
        description="Monitor WhatsApp send status and manage resends or cancellations."
      />
      <SectionCard
        title="Outbox"
        description="Resend or cancel notifications. Actions persist when Supabase credentials are present."
      >
        {data.length ? (
          <NotificationsTable initialData={data} />
        ) : (
          <EmptyState
            title="Outbox empty"
            description="No notifications yet. Activities will appear once Supabase data is connected."
          />
        )}
      </SectionCard>
    </div>
  );
}
