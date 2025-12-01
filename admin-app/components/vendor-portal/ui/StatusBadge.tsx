'use client';

/**
 * StatusBadge - Status indicator component
 * Displays transaction or payment status with color coding
 */

import { Check, Clock, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';
type StatusType = 'completed' | 'pending' | 'failed';

interface StatusBadgeProps {
  status: StatusType;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { variant: BadgeVariant; label: string; icon: typeof Check }> = {
  completed: { variant: 'success', label: 'Completed', icon: Check },
  pending: { variant: 'warning', label: 'Pending', icon: Clock },
  failed: { variant: 'danger', label: 'Failed', icon: X },
};

export function StatusBadge({ status, showLabel = false, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (!showLabel) {
    return (
      <span
        className={cn(
          'vp-transaction__status',
          className
        )}
        aria-label={config.label}
      >
        <Icon className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span className={cn(`vp-badge vp-badge--${config.variant}`, className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
