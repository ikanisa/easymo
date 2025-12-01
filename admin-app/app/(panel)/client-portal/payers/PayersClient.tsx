"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  useSmsVendorsQuery,
  useVendorLedgersQuery,
  type VendorLedgersQueryParams,
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
  });
}

export function PayersClient() {
  const vendorsQuery = useSmsVendorsQuery({ limit: 1, status: "active" });
  const firstVendor = vendorsQuery.data?.data?.[0];
  
  const [params, setParams] = useState<Omit<VendorLedgersQueryParams, "vendorId">>({
    limit: 50,
  });
  const [search, setSearch] = useState("");

  const ledgersQuery = useVendorLedgersQuery(
    { vendorId: firstVendor?.id ?? "", ...params },
  );

  const payers = ledgersQuery.data?.data ?? [];
  const hasMore = ledgersQuery.data?.hasMore;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams((prev) => ({
      ...prev,
      search: search || undefined,
      offset: 0,
    }));
  };

  const handleLoadMore = () => {
    setParams((prev) => ({
      ...prev,
      limit: (prev.limit ?? 50) + 50,
    }));
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
        <PageHeader title="Payers" description="View payer ledgers and payment history." />
        <EmptyState
          title="No active vendor account"
          description="You need an active vendor account to view payers."
          action={
            <Link href="/sms-vendors">
              <Button variant="primary">View Vendors</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Calculate totals
  const totalPaid = payers.reduce((sum, p) => sum + p.totalPaid, 0);
  const totalPayments = payers.reduce((sum, p) => sum + p.paymentCount, 0);

  return (
    <div className="admin-page">
      <PageHeader
        title="Payers"
        description="View all payers with running balances and payment history."
        actions={
          <Link href="/client-portal">
            <Button variant="ghost">Back to Portal</Button>
          </Link>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Payers</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {payers.length}
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Payments</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {totalPayments}
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Received</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(totalPaid)}
          </p>
        </div>
      </div>

      <SectionCard
        title="Payer Ledgers"
        description="All payers sorted by total amount paid."
        actions={
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        }
      >
        {ledgersQuery.isLoading ? (
          <LoadingState title="Loading payers" description="Fetching payer data..." />
        ) : payers.length === 0 ? (
          <EmptyState
            title="No payers found"
            description="Payers will appear here once you start receiving payments."
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--aurora-border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Payer
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Total Paid
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Payments
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      First Payment
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Last Payment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payers.map((payer) => (
                    <tr key={payer.id} className="border-b border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-elevated)]">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-[var(--aurora-text-primary)]">{payer.payerName || "Unknown"}</p>
                          <p className="text-xs text-[var(--aurora-text-muted)]">{payer.payerPhone}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--aurora-text-primary)] font-medium">
                        {formatCurrency(payer.totalPaid, payer.currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--aurora-text-secondary)]">
                        {payer.paymentCount}
                      </td>
                      <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                        {formatDate(payer.firstPaymentAt)}
                      </td>
                      <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                        {formatDate(payer.lastPaymentAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  loading={ledgersQuery.isFetching}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
