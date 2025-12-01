'use client';

/**
 * Payers Page
 * List of all payers with search and sort
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PortalShell } from '@/components/vendor-portal/layout';
import { PayerList } from '@/components/vendor-portal/payers';
import { mockPayers } from '@/lib/vendor-portal/mock-data';
import type { Payer } from '@/lib/vendor-portal/types';

export default function PayersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handlePayerClick = (payer: Payer) => {
    // Navigate to payer detail page
    router.push(`/vendor-portal/payers/${payer.id}`);
  };

  return (
    <PortalShell title="Payers">
      <PayerList
        payers={mockPayers}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onPayerClick={handlePayerClick}
      />
    </PortalShell>
  );
}
