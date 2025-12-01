'use client';

/**
 * MoneyDisplay - Currency formatting component
 * Displays amounts with proper formatting for RWF and other currencies
 */

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/vendor-portal/mock-data';

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSign?: boolean;
}

export function MoneyDisplay({
  amount,
  currency = 'RWF',
  className,
  size = 'md',
  showSign = false,
}: MoneyDisplayProps) {
  const formattedAmount = formatCurrency(amount, currency);
  const displayValue = showSign && amount > 0 ? `+${formattedAmount}` : formattedAmount;

  return (
    <span
      className={cn(
        'vp-money',
        size === 'lg' && 'vp-money--large',
        className
      )}
    >
      {displayValue}
    </span>
  );
}
