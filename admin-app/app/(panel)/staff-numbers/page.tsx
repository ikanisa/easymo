import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StaffNumbersTable } from '@/components/staff/StaffNumbersTable';
import { listStaffNumbers } from '@/lib/data-provider';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function StaffNumbersPage() {
  const { data } = await listStaffNumbers({ limit: 200 });

  return (
    <div className="admin-page">
      <PageHeader
        title="Staff Numbers"
        description="Platform-wide directory of receiving numbers, roles, and verification status."
      />
      <SectionCard
        title="Receiving numbers"
        description="Actions to deactivate, verify, or change roles will be added once write APIs are in place."
      >
        {data.length ? (
          <StaffNumbersTable data={data} />
        ) : (
          <EmptyState
            title="No staff numbers yet"
            description="Load fixtures or connect to Supabase to view receiving numbers."
          />
        )}
      </SectionCard>
    </div>
  );
}
