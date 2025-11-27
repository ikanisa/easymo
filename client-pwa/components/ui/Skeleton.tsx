import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circle' | 'text';
}

export function Skeleton({
  className,
  variant = 'default',
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        {
          'rounded-lg': variant === 'default',
          'rounded-full': variant === 'circle',
          'rounded h-4': variant === 'text',
        },
        className
      )}
      {...props}
    />
  );
}

export function MenuItemSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      <Skeleton className="w-full aspect-square" />
      <div className="p-3 space-y-2">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-full h-3" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  );
}

export function CategoryTabSkeleton() {
  return (
    <div className="flex gap-2 px-4 py-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
      ))}
    </div>
  );
}
