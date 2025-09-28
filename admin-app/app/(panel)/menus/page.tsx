import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MenuTable } from '@/components/menus/MenuTable';
import { OcrJobsTable } from '@/components/menus/OcrJobsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMenuVersions, listOcrJobs } from '@/lib/data-provider';

export default async function MenusPage() {
  const [{ data: menus }, { data: ocrJobs }] = await Promise.all([
    listMenuVersions({ limit: 100 }),
    listOcrJobs({ limit: 50 })
  ]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Menus & OCR"
        description="Track menu drafts, published versions, and OCR pipelines. Support can review extracted content before it reaches vendors."
      />

      <SectionCard
        title="Menu versions"
        description="Drafts and published versions per bar. Actions to view, publish, duplicate, and archive will appear in subsequent phases."
      >
        {menus.length ? (
          <MenuTable data={menus} />
        ) : (
          <EmptyState
            title="No menus yet"
            description="Load fixtures or connect Supabase to view menu records."
          />
        )}
      </SectionCard>

      <SectionCard
        title="OCR job queue"
        description="Monitor OCR ingestion, retry failures, and map text to drafts."
      >
        {ocrJobs.length ? (
          <OcrJobsTable data={ocrJobs} />
        ) : (
          <EmptyState
            title="Queue is empty"
            description="Once vendors upload menus, they will appear here for review."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Draft helper"
        description="Read-only view of the vendor WhatsApp experience will be embedded here in future iterations."
      >
        <EmptyState
          title="Preview coming soon"
          description="Support will soon be able to preview the vendor-side flow and trigger review reminders."
        />
      </SectionCard>
    </div>
  );
}
