'use client';

/**
 * RevenueChart - 7-day bar chart for revenue visualization
 * Simple, accessible bar chart without external dependencies
 */

import type { RevenueDataPoint } from '@/lib/vendor-portal/types';

interface RevenueChartProps {
  data: RevenueDataPoint[];
  title?: string;
  isLoading?: boolean;
}

export function RevenueChart({
  data,
  title = 'Last 7 Days',
  isLoading = false,
}: RevenueChartProps) {
  // Calculate max amount for scaling
  const maxAmount = Math.max(...data.map(d => d.amount));

  if (isLoading) {
    return (
      <div className="vp-card vp-chart">
        <div className="vp-skeleton h-4 w-24 mb-4" />
        <div className="vp-chart__bars">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div 
              key={i} 
              className="vp-skeleton flex-1"
              style={{ height: `${Math.random() * 60 + 20}%` }}
            />
          ))}
        </div>
        <div className="vp-chart__labels">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="vp-skeleton h-3 w-6" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="vp-card vp-chart" role="img" aria-label="Revenue chart for last 7 days">
      <h3 className="vp-chart__title">📊 {title}</h3>
      <div className="vp-chart__bars">
        {data.map((point, index) => {
          const heightPercent = maxAmount > 0 ? (point.amount / maxAmount) * 100 : 0;
          return (
            <div
              key={point.day}
              className="vp-chart__bar"
              style={{ height: `${Math.max(heightPercent, 5)}%` }}
              title={`${point.label}: RWF ${point.amount.toLocaleString()}`}
              role="presentation"
              aria-label={`${point.label}: ${point.amount.toLocaleString()} RWF`}
              tabIndex={0}
            />
          );
        })}
      </div>
      <div className="vp-chart__labels">
        {data.map((point) => (
          <span key={point.day} className="vp-chart__label">
            {point.label.charAt(0)}
          </span>
        ))}
      </div>
    </div>
  );
}
