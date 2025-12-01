'use client';

/**
 * EmptyState - Empty state illustration component
 * Shows when there's no data to display
 */

import { FileText, Inbox, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

type EmptyStateType = 'transactions' | 'payers' | 'default';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const emptyStateConfig: Record<EmptyStateType, { icon: typeof Inbox; defaultTitle: string; defaultDescription: string }> = {
  transactions: {
    icon: FileText,
    defaultTitle: 'No transactions yet',
    defaultDescription: 'When you receive payments via SMS, they will appear here.',
  },
  payers: {
    icon: Users,
    defaultTitle: 'No payers found',
    defaultDescription: 'Payers will be added automatically when they make a payment.',
  },
  default: {
    icon: Inbox,
    defaultTitle: 'Nothing here',
    defaultDescription: 'There\'s no data to display at the moment.',
  },
};

export function EmptyState({
  type = 'default',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn('vp-empty', className)}>
      <Icon className="vp-empty__icon" aria-hidden="true" />
      <h3 className="vp-empty__title">{title || config.defaultTitle}</h3>
      <p className="vp-empty__description">
        {description || config.defaultDescription}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
