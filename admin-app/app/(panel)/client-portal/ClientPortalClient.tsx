"use client";

import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  useSmsVendorsQuery,
  useVendorStatsQuery,
  useVendorTransactionsQuery,
} from "@/lib/queries/sms-vendors";

function formatCurrency(amount: number, currency: string = "RWF"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientPortalClient() {
  // For now, we'll show an overview of all vendors
  // In a real implementation, this would be scoped to the logged-in vendor
  const vendorsQuery = useSmsVendorsQuery({ limit: 1, status: "active" });
  const firstVendor = vendorsQuery.data?.data?.[0];
  
  const statsQuery = useVendorStatsQuery(firstVendor?.id ?? "");
  
  const transactionsQuery = useVendorTransactionsQuery(
    { vendorId: firstVendor?.id ?? "", limit: 10 },
  );

  const stats = statsQuery.data;
  const recentTransactions = transactionsQuery.data?.data ?? [];

  // Calculate today's and this week's stats from recent transactions
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const todayTransactions = recentTransactions.filter(
    (t) => new Date(t.createdAt) >= startOfToday
  );
  const thisWeekTransactions = recentTransactions.filter(
    (t) => new Date(t.createdAt) >= startOfWeek
  );

  const todayRevenue = todayTransactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const thisWeekRevenue = thisWeekTransactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);

  if (vendorsQuery.isLoading) {
    return (
      <div className="admin-page">
        <LoadingState title="Loading portal" description="Fetching your data..." />
      </div>
    );
  }

  if (!firstVendor) {
    return (
      <div className="admin-page">
        <PageHeader
          title="Client Portal"
          description="Vendor portal for viewing transactions, payers, and reports."
        />
        <EmptyState
          title="No active vendor account"
          description="You need an active vendor account to access the client portal."
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
        title="Client Portal"
        description={`Welcome back, ${firstVendor.vendorName}`}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Today</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(todayRevenue)}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {todayTransactions.length} transactions
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">This Week</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(thisWeekRevenue)}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {thisWeekTransactions.length} transactions
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">This Month</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(stats?.thisMonthRevenue ?? 0)}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {stats?.thisMonthTransactions ?? 0} transactions
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">All Time</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(stats?.totalRevenue ?? 0)}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {stats?.totalTransactions ?? 0} transactions • {stats?.uniquePayers ?? 0} payers
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/client-portal/transactions" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-6 hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <h3 className="text-lg font-semibold text-[var(--aurora-text-primary)] mb-2">
              Transactions
            </h3>
            <p className="text-sm text-[var(--aurora-text-secondary)]">
              View your complete transaction history with search and filters.
            </p>
          </div>
        </Link>
        <Link href="/client-portal/payers" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-6 hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <h3 className="text-lg font-semibold text-[var(--aurora-text-primary)] mb-2">
              Payers
            </h3>
            <p className="text-sm text-[var(--aurora-text-secondary)]">
              View all payers with running balances and payment history.
            </p>
          </div>
        </Link>
        <Link href="/client-portal/reports" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-6 hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <h3 className="text-lg font-semibold text-[var(--aurora-text-primary)] mb-2">
              Reports
            </h3>
            <p className="text-sm text-[var(--aurora-text-secondary)]">
              View periodic summaries and analytics for your business.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Transactions Preview */}
      <SectionCard
        title="Recent Transactions"
        description="Your latest payment transactions."
        actions={
          <Link href="/client-portal/transactions">
            <Button variant="secondary" size="sm">
              View All
            </Button>
          </Link>
        }
      >
        {transactionsQuery.isLoading ? (
          <LoadingState title="Loading transactions" />
        ) : recentTransactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Transactions will appear here once you start receiving SMS payments."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--aurora-border)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                    Payer
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                    Provider
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.slice(0, 5).map((txn) => (
                  <tr key={txn.id} className="border-b border-[var(--aurora-border)]">
                    <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                      {formatDate(txn.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-[var(--aurora-text-primary)]">{txn.payerName || "Unknown"}</p>
                        <p className="text-xs text-[var(--aurora-text-muted)]">{txn.payerPhone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--aurora-text-primary)] font-medium">
                      {txn.amount !== null ? formatCurrency(txn.amount, txn.currency) : "—"}
                    </td>
                    <td className="py-3 px-4 text-[var(--aurora-text-secondary)] uppercase">
                      {txn.provider || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
