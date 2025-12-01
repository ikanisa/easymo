'use client';

/**
 * RecentTransactions - Quick list of recent transactions for dashboard
 * Shows the most recent 5 transactions with a "View All" link
 */

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { TransactionCard } from '@/components/vendor-portal/transactions';
import { EmptyState, TransactionSkeleton } from '@/components/vendor-portal/ui';
import type { Transaction } from '@/lib/vendor-portal/types';

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
  limit?: number;
}

export function RecentTransactions({
  transactions,
  isLoading = false,
  limit = 5,
}: RecentTransactionsProps) {
  const recentTransactions = transactions.slice(0, limit);

  return (
    <section>
      <div className="vp-section-header">
        <h2 className="vp-section-title">Recent Transactions</h2>
        <Link href="/vendor-portal/transactions" className="vp-section-link">
          View All <ChevronRight className="inline w-4 h-4" />
        </Link>
      </div>
      
      <div className="vp-card">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <TransactionSkeleton key={i} />
            ))}
          </>
        ) : recentTransactions.length === 0 ? (
          <EmptyState type="transactions" />
        ) : (
          recentTransactions.map((txn) => (
            <TransactionCard key={txn.id} transaction={txn} />
          ))
        )}
      </div>
    </section>
  );
}
