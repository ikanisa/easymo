'use client';

/**
 * TransactionCard - Individual transaction display
 * Shows payer info, amount, time, and status
 */

import { Check } from 'lucide-react';

import { formatCurrency, formatTime } from '@/lib/vendor-portal/mock-data';
import type { Transaction } from '@/lib/vendor-portal/types';

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return 'XX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const initials = getInitials(transaction.payerName);

  return (
    <button
      type="button"
      className="vp-transaction w-full text-left"
      onClick={onClick}
      aria-label={`Transaction from ${transaction.payerName} for ${formatCurrency(transaction.amount, transaction.currency)}`}
    >
      <div className="vp-transaction__avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="vp-transaction__content">
        <p className="vp-transaction__name">{transaction.payerName}</p>
        <p className="vp-transaction__phone">{transaction.payerPhone}</p>
      </div>
      <div className="vp-transaction__meta">
        <p className="vp-transaction__amount">
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
        <div className="flex items-center gap-1">
          <span className="vp-transaction__time">
            {formatTime(transaction.timestamp)}
          </span>
          {transaction.status === 'completed' && (
            <span className="vp-transaction__status" aria-label="Completed">
              <Check className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
