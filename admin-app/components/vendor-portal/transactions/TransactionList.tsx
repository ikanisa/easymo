'use client';

/**
 * TransactionList - Virtualized list of transactions
 * Groups by date with sticky headers
 */

import { EmptyState, TransactionSkeleton } from '@/components/vendor-portal/ui';
import { groupTransactionsByDate } from '@/lib/vendor-portal/mock-data';
import type { Transaction } from '@/lib/vendor-portal/types';

import { TransactionCard } from './TransactionCard';

interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onTransactionClick?: (transaction: Transaction) => void;
}

export function TransactionList({
  transactions,
  isLoading = false,
  onTransactionClick,
}: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="vp-card">
        {[1, 2, 3, 4, 5].map((i) => (
          <TransactionSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="vp-card">
        <EmptyState type="transactions" />
      </div>
    );
  }

  const groupedTransactions = groupTransactionsByDate(transactions);

  return (
    <div className="space-y-4">
      {Array.from(groupedTransactions.entries()).map(([dateLabel, txns]) => (
        <section key={dateLabel}>
          <h3 className="vp-date-header">{dateLabel}</h3>
          <div className="vp-card">
            {txns.map((txn) => (
              <TransactionCard
                key={txn.id}
                transaction={txn}
                onClick={() => onTransactionClick?.(txn)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
