"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  useSmsVendorsQuery,
  useVendorTransactionsQuery,
  type VendorTransactionsQueryParams,
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

export function TransactionsClient() {
  const vendorsQuery = useSmsVendorsQuery({ limit: 1, status: "active" });
  const firstVendor = vendorsQuery.data?.data?.[0];
  
  const [params, setParams] = useState<Omit<VendorTransactionsQueryParams, "vendorId">>({
    limit: 50,
  });
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const transactionsQuery = useVendorTransactionsQuery(
    { vendorId: firstVendor?.id ?? "", ...params },
  );

  const transactions = transactionsQuery.data?.data ?? [];
  const hasMore = transactionsQuery.data?.hasMore;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams((prev) => ({
      ...prev,
      search: search || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
      offset: 0,
    }));
  };

  const handleLoadMore = () => {
    setParams((prev) => ({
      ...prev,
      limit: (prev.limit ?? 50) + 50,
    }));
  };

  const handleExport = () => {
    if (transactions.length === 0) return;
    
    const headers = ["Date", "Payer Name", "Payer Phone", "Amount", "Currency", "Provider", "Transaction ID", "Status"];
    const rows = transactions.map((t) => [
      formatDate(t.createdAt),
      t.payerName || "",
      t.payerPhone || "",
      t.amount?.toString() || "",
      t.currency,
      t.provider || "",
      t.txnId || "",
      t.status,
    ]);
    
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
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
        <PageHeader title="Transactions" description="View your complete transaction history." />
        <EmptyState
          title="No active vendor account"
          description="You need an active vendor account to view transactions."
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
        title="Transactions"
        description="View your complete transaction history."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={transactions.length === 0}>
              Export CSV
            </Button>
            <Link href="/client-portal">
              <Button variant="ghost">Back to Portal</Button>
            </Link>
          </div>
        }
      />

      <SectionCard
        title="Transaction History"
        description="All SMS payment transactions."
        actions={
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start date"
              className="w-40"
            />
            <span className="text-[var(--aurora-text-muted)]">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
              className="w-40"
            />
            <Input
              placeholder="Search payer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
        }
      >
        {transactionsQuery.isLoading ? (
          <LoadingState title="Loading transactions" description="Fetching transaction data..." />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions found"
            description="Try adjusting your filters or wait for new transactions."
          />
        ) : (
          <div className="space-y-4">
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
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Transaction ID
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
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
                      <td className="py-3 px-4 text-[var(--aurora-text-secondary)] font-mono text-xs">
                        {txn.txnId || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={txn.status === "parsed" ? "green" : txn.status === "error" ? "red" : "gray"}>
                          {txn.status}
                        </Badge>
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
                  loading={transactionsQuery.isFetching}
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
