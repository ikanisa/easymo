import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StorageTable } from '@/components/files/StorageTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { listStorageObjects } from '@/lib/data-provider';

export default async function FilesPage() {
  const { data } = await listStorageObjects({ limit: 200 });

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Files"
        description="Browse Supabase storage buckets for vouchers, QR codes, campaign media, and insurance documents."
      />

      <SectionCard
        title="Storage browser"
        description="Signed URL generation and previews will be hooked into this table soon."
      >
        {data.length ? (
          <StorageTable data={data} />
        ) : (
          <EmptyState
            title="Storage empty"
            description="No files found. Connect to Supabase or load fixtures to inspect storage."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Preview & URL copy"
        description="Preview modal and copy-to-clipboard links will appear once the API bridge is implemented."
      >
        <EmptyState
          title="Preview pending"
          description="Expect lightbox previews for images and download links for other file types."
        />
      </SectionCard>
    </div>
  );
}
