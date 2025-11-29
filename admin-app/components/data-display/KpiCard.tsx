/**
 * Aurora KPI Card Component
 * Clean, animated metrics display with trend indicators
 */

'use client';

import { motion } from 'framer-motion';
import { TrendingDown,TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  className?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function KpiCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--aurora-surface)] border border-[var(--aurora-border)] p-5">
      <div className="space-y-3">
        <div className="h-4 w-24 bg-[var(--aurora-surface-muted)] rounded animate-pulse" />
        <div className="h-8 w-32 bg-[var(--aurora-surface-muted)] rounded animate-pulse" />
        <div className="h-4 w-20 bg-[var(--aurora-surface-muted)] rounded animate-pulse" />
      </div>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  loading,
  className,
}: KpiCardProps) {
  if (loading) {
    return <KpiCardSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
        'p-5 hover:shadow-lg hover:border-[var(--aurora-accent)]/20',
        'transition-all duration-300 group',
        className
      )}
    >
      {/* Gradient Accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--aurora-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative flex justify-between items-start">
        <div className="space-y-2 flex-1">
          {/* Title */}
          <p className="text-sm font-medium text-[var(--aurora-text-muted)]">
            {title}
          </p>

          {/* Value */}
          <p className="text-3xl font-bold text-[var(--aurora-text-primary)] tracking-tight">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>

          {/* Change Indicator */}
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  trend === 'up' && 'text-[var(--aurora-success)]',
                  trend === 'down' && 'text-[var(--aurora-error)]',
                  trend === 'neutral' && 'text-[var(--aurora-text-muted)]'
                )}
              >
                {trend === 'up' && <TrendingUp className="w-4 h-4" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4" />}
                {change > 0 ? '+' : ''}
                {change}%
              </span>

              {changeLabel && (
                <span className="text-xs text-[var(--aurora-text-muted)]">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div className="flex-shrink-0 p-3 rounded-xl bg-[var(--aurora-accent)]/10 text-[var(--aurora-accent)]">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
