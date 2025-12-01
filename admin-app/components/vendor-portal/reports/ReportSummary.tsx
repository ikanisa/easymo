'use client';

/**
 * ReportSummary - Summary card for reports page
 * Shows totals for selected period
 */

import { BarChart3 } from 'lucide-react';

import { MoneyDisplay } from '@/components/vendor-portal/ui';
import type { ReportSummary as ReportSummaryType } from '@/lib/vendor-portal/types';

interface ReportSummaryProps {
  summary: ReportSummaryType;
  isLoading?: boolean;
}

export function ReportSummary({ summary, isLoading = false }: ReportSummaryProps) {
  const periodLabels = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
  };

  if (isLoading) {
    return (
      <div className="vp-card vp-summary">
        <div className="vp-skeleton h-5 w-40 mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="vp-summary__row">
            <div className="vp-skeleton h-4 w-24" />
            <div className="vp-skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="vp-card vp-summary">
      <h3 className="vp-summary__title">
        <BarChart3 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
        {periodLabels[summary.period]} Summary
      </h3>
      
      <div className="vp-summary__row">
        <span className="vp-summary__label">Total Revenue</span>
        <span className="vp-summary__value">
          <MoneyDisplay amount={summary.totalRevenue} currency={summary.currency} />
        </span>
      </div>
      
      <div className="vp-summary__row">
        <span className="vp-summary__label">Transactions</span>
        <span className="vp-summary__value">{summary.transactionCount}</span>
      </div>
      
      <div className="vp-summary__row">
        <span className="vp-summary__label">Unique Payers</span>
        <span className="vp-summary__value">{summary.uniquePayers}</span>
      </div>
      
      <div className="vp-summary__row">
        <span className="vp-summary__label">Avg Transaction</span>
        <span className="vp-summary__value">
          <MoneyDisplay amount={summary.averageTransaction} currency={summary.currency} />
        </span>
      </div>
    </div>
  );
}
