/**
 * Aurora Badge Component
 * Status indicators and labels
 */

'use client';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--aurora-surface-muted)] text-[var(--aurora-text-primary)] border border-[var(--aurora-border)]',
        accent: 'bg-[var(--aurora-accent)] text-white',
        success: 'bg-[var(--aurora-success)] text-white',
        warning: 'bg-[var(--aurora-warning)] text-white',
        error: 'bg-[var(--aurora-error)] text-white',
        info: 'bg-[var(--aurora-info)] text-white',
        subtle: 'bg-[var(--aurora-accent-subtle)] text-[var(--aurora-accent)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ 
  className, 
  variant, 
  dot = false,
  children, 
  ...props 
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
