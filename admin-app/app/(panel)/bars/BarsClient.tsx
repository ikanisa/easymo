'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { BarsTable } from '@/components/bars/BarsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBarsQuery, type BarsQueryParams } from '@/lib/queries/bars';
import { useStaffNumbersQuery, type StaffNumbersQueryParams } from '@/lib/queries/staffNumbers';

const BAR_STATUS_FILTERS = ['active', 'inactive'] as const;

interface BarsClientProps {
  initialBarParams?: BarsQueryParams;
  staffNumbersParams?: StaffNumbersQueryParams;
}

export function BarsClient({
  initialBarParams = { limit: 100 },
  staffNumbersParams = { limit: 6 }
}: BarsClientProps) {
  const [barParams, setBarParams] = useState<BarsQueryParams>(initialBarParams);
  const barsQuery = useBarsQuery(barParams);
  const staffNumbersQuery = useStaffNumbersQuery(staffNumbersParams);

  const bars = useMemo(() => barsQuery.data?.data ?? [], [barsQuery.data?.data]);
  const staffNumbers = useMemo(() => staffNumbersQuery.data?.data ?? [], [staffNumbersQuery.data?.data]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Bars"
        description="Admin override surface for bar profiles, contact numbers, settings, and audit trails."
      />

      <SectionCard
        title="Bars overview"
        description="Filter by status or search by name to locate a bar quickly. Row actions will connect to drawers and overrides in later phases."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[color:var(--color-muted)]">
              Status
              <select
                value={barParams.status ?? ''}
                onChange={(event) => setBarParams((prev) => ({ ...prev, status: event.target.value || undefined }))}
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              >
                <option value="">All</option>
                {BAR_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[color:var(--color-muted)]">
              Search
              <input
                value={barParams.search ?? ''}
                onChange={(event) => setBarParams((prev) => ({ ...prev, search: event.target.value || undefined }))}
                placeholder="Chez Lando"
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              />
            </label>
          </div>
        }
      >
        {barsQuery.isLoading ? (
          <LoadingState title="Loading bars" description="Fetching bar directory." />
        ) : bars.length ? (
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
        {staffNumbersQuery.isLoading ? (
          <LoadingState title="Loading staff numbers" description="Fetching recent receiving numbers." />
        ) : staffNumbers.length ? (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {staffNumbers.map((number) => (
              <li
                key={number.id}
                className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4"
              >
                <strong className="text-[color:var(--color-foreground)]">{number.barName}</strong>
                <p className="text-sm text-[color:var(--color-muted)]">
                  {number.number} • {number.role}
                </p>
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
