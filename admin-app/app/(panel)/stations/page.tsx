import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { listStations } from '@/lib/data-provider';
import { StationListWithActions } from '@/components/stations/StationListWithActions';

export default async function StationsPage() {
  const { data } = await listStations({ limit: 200 });

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Stations"
        description="Manage station records, operator contacts, and recent voucher redemptions."
      />
      <SectionCard
        title="Station directory"
        description="Create, activate/deactivate, and delete stations. Actions currently persist only when Supabase credentials are configured."
      >
        {data.length ? (
          <StationListWithActions stations={data} />
        ) : (
          <EmptyState
            title="No stations"
            description="Add a station to get started or connect Supabase to view existing records."
          />
        )}
      </SectionCard>
    </div>
  );
}
