import { PageHeader } from '@/components/layout/PageHeader';
import { LogsClient } from '@/components/logs/LogsClient';

export default function LogsPage() {
  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Logs"
        description="Unified audit and voucher event stream with filters, JSON drawer, and export options."
      />
      <LogsClient />
    </div>
  );
}
