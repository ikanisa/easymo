import { PageHeader } from '@/components/layout/PageHeader';
import { UsersTable } from '@/components/users/UsersTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { listUsers } from '@/lib/data-provider';

export default async function UsersPage() {
  const { data } = await listUsers({ limit: 200 });

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Users"
        description="Search, filter, and inspect user profiles. Drawers will surface voucher activity and insurance quotes soon."
      />
      <SectionCard
        title="Directory"
        description="Click a name to open the profile drawer. Actions will expand as write APIs arrive."
      >
        {data.length ? (
          <UsersTable data={data} />
        ) : (
          <EmptyState
            title="No users yet"
            description="Load fixtures or connect Supabase to populate the directory."
          />
        )}
      </SectionCard>
      <SectionCard
        title="Next steps"
        description="Voucher history, insurance interactions, and quick actions will live in the drawer."
      >
        <EmptyState
          title="Drawer enhancements pending"
          description="Future milestones will add voucher timelines and insurance review data here."
        />
      </SectionCard>
    </div>
  );
}
