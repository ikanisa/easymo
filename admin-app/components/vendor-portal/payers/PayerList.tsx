'use client';

/**
 * PayerList - List of payers with search and sort
 */

import { EmptyState, PayerSkeleton, SearchInput } from '@/components/vendor-portal/ui';
import type { Payer, SortOption } from '@/lib/vendor-portal/types';

import { PayerCard } from './PayerCard';

interface PayerListProps {
  payers: Payer[];
  isLoading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  onPayerClick?: (payer: Payer) => void;
}

export function PayerList({
  payers,
  isLoading = false,
  searchQuery = '',
  onSearchChange,
  onPayerClick,
}: PayerListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <SearchInput
          placeholder="Search payers"
          value={searchQuery}
          onChange={onSearchChange}
        />
        <div className="vp-card">
          {[1, 2, 3, 4].map((i) => (
            <PayerSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const filteredPayers = payers.filter(
    (payer) =>
      payer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payer.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      <SearchInput
        placeholder="Search payers"
        value={searchQuery}
        onChange={onSearchChange}
      />
      
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-gray-500">
          {filteredPayers.length} payer{filteredPayers.length !== 1 ? 's' : ''}
        </span>
        <span className="text-sm text-gray-500">
          Sort by: Total Paid
        </span>
      </div>

      {filteredPayers.length === 0 ? (
        <div className="vp-card">
          <EmptyState 
            type="payers" 
            title={searchQuery ? 'No payers found' : undefined}
            description={searchQuery ? 'Try a different search term' : undefined}
          />
        </div>
      ) : (
        <div className="vp-card">
          {filteredPayers.map((payer) => (
            <PayerCard
              key={payer.id}
              payer={payer}
              onClick={() => onPayerClick?.(payer)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
