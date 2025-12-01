'use client';

/**
 * Reports Page
 * Summary stats and export options
 */

import { useState } from 'react';

import { PortalShell } from '@/components/vendor-portal/layout';
import { ExportButtons, ReportSummary } from '@/components/vendor-portal/reports';
import { FilterChips } from '@/components/vendor-portal/ui';
import { mockReportSummary, mockRevenueData } from '@/lib/vendor-portal/mock-data';
import type { ReportSummary as ReportSummaryType } from '@/lib/vendor-portal/types';

type ReportPeriod = 'today' | 'week' | 'month';

const periodOptions = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

// Generate different summaries for different periods
function getSummaryForPeriod(period: ReportPeriod): ReportSummaryType {
  const base = mockReportSummary;
  switch (period) {
    case 'today':
      return {
        ...base,
        totalRevenue: 125000,
        transactionCount: 8,
        uniquePayers: 6,
        averageTransaction: 15625,
        period: 'today',
      };
    case 'week':
      return { ...base, period: 'week' };
    case 'month':
      return {
        ...base,
        totalRevenue: 3200000,
        transactionCount: 145,
        uniquePayers: 42,
        averageTransaction: 22069,
        period: 'month',
      };
  }
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const summary = getSummaryForPeriod(period);

  const handleExportCSV = () => {
    // In a real app, this would trigger a CSV download
    console.log('Exporting CSV for period:', period);
    alert('CSV export started. Check your downloads.');
  };

  const handleExportPDF = () => {
    // In a real app, this would trigger a PDF download
    console.log('Exporting PDF for period:', period);
    alert('PDF export started. Check your downloads.');
  };

  return (
    <PortalShell title="Reports">
      <div className="space-y-6">
        {/* Period Filter */}
        <FilterChips
          options={periodOptions}
          activeId={period}
          onChange={(id) => setPeriod(id as ReportPeriod)}
        />
        
        {/* Summary Card */}
        <ReportSummary summary={summary} />
        
        {/* Revenue Chart (simplified for reports) */}
        <div className="vp-card vp-chart">
          <h3 className="vp-chart__title">Revenue Trend</h3>
          <div className="vp-chart__bars">
            {mockRevenueData.map((point) => {
              const maxAmount = Math.max(...mockRevenueData.map(d => d.amount));
              const heightPercent = maxAmount > 0 ? (point.amount / maxAmount) * 100 : 0;
              return (
                <div
                  key={point.day}
                  className="vp-chart__bar"
                  style={{ height: `${Math.max(heightPercent, 5)}%` }}
                  title={`${point.label}: RWF ${point.amount.toLocaleString()}`}
                />
              );
            })}
          </div>
          <div className="vp-chart__labels">
            {mockRevenueData.map((point) => (
              <span key={point.day} className="vp-chart__label">{point.label}</span>
            ))}
          </div>
        </div>
        
        {/* Export Buttons */}
        <ExportButtons
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
        />
      </div>
    </PortalShell>
  );
}
