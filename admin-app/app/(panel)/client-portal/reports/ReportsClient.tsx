"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  useSmsVendorsQuery,
  useVendorReportsQuery,
  type VendorReportsQueryParams,
} from "@/lib/queries/sms-vendors";

function formatCurrency(amount: number, currency: string = "RWF"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ReportsClient() {
  const vendorsQuery = useSmsVendorsQuery({ limit: 1, status: "active" });
  const firstVendor = vendorsQuery.data?.data?.[0];
  
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const reportsQuery = useVendorReportsQuery(
    { vendorId: firstVendor?.id ?? "", period },
  );

  const reports = reportsQuery.data ?? [];

  // Calculate summary
  const totalRevenue = reports.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalTransactions = reports.reduce((sum, r) => sum + r.transactionCount, 0);
  const avgPerPeriod = reports.length > 0 ? totalRevenue / reports.length : 0;

  const handleExport = () => {
    if (reports.length === 0) return;
    
    const headers = ["Period", "Transactions", "Revenue", "Unique Payers"];
    const rows = reports.map((r) => [
      r.period,
      r.transactionCount.toString(),
      r.totalRevenue.toString(),
      r.uniquePayers.toString(),
    ]);
    
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (vendorsQuery.isLoading) {
    return (
      <div className="admin-page">
        <LoadingState title="Loading" description="Fetching your data..." />
      </div>
    );
  }

  if (!firstVendor) {
    return (
      <div className="admin-page">
        <PageHeader title="Reports" description="View periodic transaction reports and analytics." />
        <EmptyState
          title="No active vendor account"
          description="You need an active vendor account to view reports."
          action={
            <Link href="/sms-vendors">
              <Button variant="primary">View Vendors</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Reports"
        description="View periodic summaries and analytics for your business."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={reports.length === 0}>
              Export CSV
            </Button>
            <Link href="/client-portal">
              <Button variant="ghost">Back to Portal</Button>
            </Link>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Revenue</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Transactions</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {totalTransactions}
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Avg. per {period === "daily" ? "Day" : period === "weekly" ? "Week" : "Month"}</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(avgPerPeriod)}
          </p>
        </div>
      </div>

      <SectionCard
        title="Periodic Reports"
        description="Transaction summaries grouped by time period."
        actions={
          <div className="flex gap-2">
            <Button
              variant={period === "daily" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setPeriod("daily")}
            >
              Daily
            </Button>
            <Button
              variant={period === "weekly" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setPeriod("weekly")}
            >
              Weekly
            </Button>
            <Button
              variant={period === "monthly" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setPeriod("monthly")}
            >
              Monthly
            </Button>
          </div>
        }
      >
        {reportsQuery.isLoading ? (
          <LoadingState title="Loading reports" description="Generating report data..." />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No data for this period"
            description="Start receiving payments to see reports."
          />
        ) : (
          <div className="space-y-6">
            {/* Simple bar chart representation */}
            <div className="space-y-2">
              {reports.slice(0, 12).map((report) => {
                const maxRevenue = Math.max(...reports.map((r) => r.totalRevenue));
                const widthPercent = maxRevenue > 0 ? (report.totalRevenue / maxRevenue) * 100 : 0;
                
                return (
                  <div key={report.period} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-[var(--aurora-text-secondary)] shrink-0">
                      {report.period}
                    </div>
                    <div className="flex-1 h-8 bg-[var(--aurora-surface)] rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-[var(--aurora-accent)] rounded-lg transition-all duration-300"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <div className="w-28 text-right text-sm font-medium text-[var(--aurora-text-primary)]">
                      {formatCurrency(report.totalRevenue)}
                    </div>
                    <div className="w-20 text-right text-xs text-[var(--aurora-text-muted)]">
                      {report.transactionCount} txns
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Table */}
            <div className="border-t border-[var(--aurora-border)] pt-6">
              <h4 className="text-sm font-medium text-[var(--aurora-text-secondary)] mb-4">
                Detailed Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--aurora-border)]">
                      <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                        Period
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                        Revenue
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                        Transactions
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                        Unique Payers
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                        Top Payer
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.period} className="border-b border-[var(--aurora-border)]">
                        <td className="py-3 px-4 text-[var(--aurora-text-primary)]">
                          {report.period}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--aurora-text-primary)] font-medium">
                          {formatCurrency(report.totalRevenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--aurora-text-secondary)]">
                          {report.transactionCount}
                        </td>
                        <td className="py-3 px-4 text-right text-[var(--aurora-text-secondary)]">
                          {report.uniquePayers}
                        </td>
                        <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                          {report.topPayers[0] ? (
                            <span>
                              {report.topPayers[0].payerName || report.topPayers[0].payerPhone}
                              <span className="text-xs text-[var(--aurora-text-muted)] ml-2">
                                ({formatCurrency(report.topPayers[0].totalPaid)})
                              </span>
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
