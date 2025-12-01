'use client';

/**
 * TransactionFilters - Search and filter controls
 * Includes search input and date filter chips
 */

import { FilterChips, SearchInput } from '@/components/vendor-portal/ui';
import type { DateFilter } from '@/lib/vendor-portal/types';

interface TransactionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

const dateFilterOptions = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

export function TransactionFilters({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
}: TransactionFiltersProps) {
  return (
    <div className="space-y-3">
      <SearchInput
        placeholder="Search payer name or phone"
        value={searchQuery}
        onChange={onSearchChange}
      />
      <FilterChips
        options={dateFilterOptions}
        activeId={dateFilter}
        onChange={(id) => onDateFilterChange(id as DateFilter)}
      />
    </div>
  );
}
