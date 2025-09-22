import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { BarsTable } from '@/components/bars/BarsTable';
import { listBars, listStaffNumbers } from '@/lib/data-provider';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function BarsPage() {
  const [{ data: bars }, staffNumbers] = await Promise.all([
    listBars({ limit: 100 }),
    listStaffNumbers({ limit: 6 })
  ]);

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Bars"
        description="Admin override surface for bar profiles, contact numbers, settings, and audit trails."
      />

      <SectionCard
        title="Bars overview"
        description="Filter by status or search by name to locate a bar quickly. Row actions will connect to drawers and overrides in later phases."
      >
        {bars.length ? (
          <BarsTable data={bars} />
        ) : (
          <EmptyState
            title="No bars available"
            description="Fixtures not loaded yet. Configure Supabase or load staging fixtures to view records."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Common follow-up"
        description="Recent staff numbers give quick context while the detail drawer is under construction."
      >
        {staffNumbers.data.length ? (
          <ul className="cards-list">
            {staffNumbers.data.map((number) => (
              <li key={number.id} className="cards-list__item">
                <strong>{number.barName}</strong>
                <p className="cell-muted">{number.number} • {number.role}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No staff numbers yet"
            description="Once fixtures are loaded, the latest receiving numbers will appear here."
          />
        )}
      </SectionCard>
    </div>
  );
}
