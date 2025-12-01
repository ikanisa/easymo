'use client';

/**
 * LoadingSkeleton - Loading state component
 * Shows animated placeholder while content is loading
 */

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function LoadingSkeleton({
  className,
  width,
  height = 16,
  rounded = 'md',
}: LoadingSkeletonProps) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={cn('vp-skeleton', roundedClass[rounded], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      role="status"
      aria-label="Loading..."
    />
  );
}

/**
 * TransactionSkeleton - Loading skeleton for transaction cards
 */
export function TransactionSkeleton() {
  return (
    <div className="vp-transaction">
      <LoadingSkeleton width={40} height={40} rounded="full" />
      <div className="vp-transaction__content">
        <LoadingSkeleton width="60%" height={16} className="mb-1" />
        <LoadingSkeleton width="40%" height={12} />
      </div>
      <div className="vp-transaction__meta">
        <LoadingSkeleton width={80} height={16} className="mb-1" />
        <LoadingSkeleton width={50} height={12} />
      </div>
    </div>
  );
}

/**
 * StatCardSkeleton - Loading skeleton for stat cards
 */
export function StatCardSkeleton() {
  return (
    <div className="vp-card vp-stat-card">
      <LoadingSkeleton width="60%" height={14} className="mb-2" />
      <LoadingSkeleton width="80%" height={24} className="mb-2" />
      <LoadingSkeleton width="40%" height={14} />
    </div>
  );
}

/**
 * PayerSkeleton - Loading skeleton for payer cards
 */
export function PayerSkeleton() {
  return (
    <div className="vp-payer">
      <LoadingSkeleton width={48} height={48} rounded="lg" />
      <div className="vp-payer__content">
        <LoadingSkeleton width="50%" height={16} className="mb-1" />
        <LoadingSkeleton width="40%" height={14} className="mb-1" />
        <LoadingSkeleton width="70%" height={12} />
      </div>
      <LoadingSkeleton width={20} height={20} />
    </div>
  );
}
