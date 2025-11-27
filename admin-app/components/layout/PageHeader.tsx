/**
 * Aurora Page Header Component
 * Consistent page header with title, description, and actions
 */

'use client';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-6', className)}>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-[var(--aurora-text-primary)] tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[var(--aurora-text-secondary)]">{description}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
