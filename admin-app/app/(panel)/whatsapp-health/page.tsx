import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { WebhookErrorList } from '@/components/whatsapp/WebhookErrorList';
import { listNotifications, listLatestWebhookErrors } from '@/lib/data-provider';

export default async function WhatsAppHealthPage() {
  const [{ data: notifications }] = await Promise.all([listNotifications({ limit: 200 })]);
  const webhookErrors = listLatestWebhookErrors();

  const total = notifications.length;
  const successCount = notifications.filter((n) => n.status === 'sent').length;
  const failureCount = notifications.filter((n) => n.status === 'failed').length;
  const queuedCount = notifications.filter((n) => n.status === 'queued').length;
  const successRate = total ? ((successCount / total) * 100).toFixed(1) : '—';

  return (
    <div className="admin-page">
      <PageHeader
        title="WhatsApp Health"
        description="Track delivery performance, webhook status, and pending retries across templates and flows."
      />

      <SectionCard title="Delivery overview" description="High-level stats from the notification outbox.">
        {total ? (
          <div className="cards-list">
            <div className="cards-list__item">
              <strong>Success rate</strong>
              <p className="cell-muted">{successRate}%</p>
            </div>
            <div className="cards-list__item">
              <strong>Queued</strong>
              <p className="cell-muted">{queuedCount}</p>
            </div>
            <div className="cards-list__item">
              <strong>Failed</strong>
              <p className="cell-muted">{failureCount}</p>
            </div>
          </div>
        ) : (
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
        <WebhookErrorList errors={webhookErrors} />
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
