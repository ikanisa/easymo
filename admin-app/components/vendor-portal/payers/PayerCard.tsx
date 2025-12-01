'use client';

/**
 * PayerCard - Payer summary card
 * Shows payer name, phone, total paid, and transaction count
 */

import { ChevronRight } from 'lucide-react';

import { formatCurrency, formatRelativeTime } from '@/lib/vendor-portal/mock-data';
import type { Payer } from '@/lib/vendor-portal/types';

interface PayerCardProps {
  payer: Payer;
  onClick?: () => void;
}

export function PayerCard({ payer, onClick }: PayerCardProps) {
  return (
    <button
      type="button"
      className="vp-payer w-full text-left vp-card--interactive"
      onClick={onClick}
      aria-label={`View ${payer.name}'s details`}
    >
      <div className="vp-payer__avatar" aria-hidden="true">
        {payer.initials}
      </div>
      <div className="vp-payer__content">
        <p className="vp-payer__name">{payer.name}</p>
        <p className="vp-payer__phone">{payer.phone}</p>
        <p className="vp-payer__stats">
          Total: {formatCurrency(payer.totalPaid, payer.currency)} · {payer.transactionCount} payments · {formatRelativeTime(payer.lastPaymentDate)}
        </p>
      </div>
      <ChevronRight className="vp-payer__arrow" aria-hidden="true" />
    </button>
  );
}
