"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  useDeleteSmsVendorMutation,
  useRegenerateApiKeyMutation,
  useSmsVendorQuery,
  useUpdateSmsVendorMutation,
  useVendorLedgersQuery,
  useVendorStatsQuery,
  useVendorTransactionsQuery,
} from "@/lib/queries/sms-vendors";

const STATUS_BADGE_VARIANTS: Record<string, "yellow" | "green" | "red" | "gray"> = {
  pending: "yellow",
  active: "green",
  suspended: "red",
  expired: "gray",
};

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

function formatCurrency(amount: number, currency: string = "RWF"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Props {
  vendorId: string;
}

export function SmsVendorDetailClient({ vendorId }: Props) {
  const router = useRouter();
  const [showCredentials, setShowCredentials] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const vendorQuery = useSmsVendorQuery(vendorId);
  const statsQuery = useVendorStatsQuery(vendorId);
  const transactionsQuery = useVendorTransactionsQuery({
    vendorId,
    limit: 50,
  });
  const ledgersQuery = useVendorLedgersQuery({
    vendorId,
    limit: 10,
  });

  const updateMutation = useUpdateSmsVendorMutation();
  const deleteMutation = useDeleteSmsVendorMutation({
    onSuccess: () => {
      router.push("/sms-vendors");
    },
  });
  const regenerateMutation = useRegenerateApiKeyMutation();

  const vendor = vendorQuery.data;
  const stats = statsQuery.data;
  const transactions = transactionsQuery.data?.data ?? [];
  const topPayers = ledgersQuery.data?.data ?? [];

  const handleActivate = async () => {
    if (!vendor) return;
    await updateMutation.mutateAsync({
      id: vendor.id,
      data: { subscriptionStatus: "active" },
    });
  };

  const handleSuspend = async () => {
    if (!vendor) return;
    await updateMutation.mutateAsync({
      id: vendor.id,
      data: { subscriptionStatus: "suspended" },
    });
  };

  const handleDelete = async () => {
    if (!vendor) return;
    await deleteMutation.mutateAsync(vendor.id);
  };

  const handleRegenerateKey = async () => {
    if (!vendor) return;
    await regenerateMutation.mutateAsync(vendor.id);
    setShowCredentials(true);
  };

  if (vendorQuery.isLoading) {
    return (
      <div className="admin-page">
        <LoadingState title="Loading vendor" description="Fetching vendor details..." />
      </div>
    );
  }

  if (vendorQuery.isError || !vendor) {
    return (
      <div className="admin-page">
        <EmptyState
          title="Vendor not found"
          description="The requested vendor could not be found."
          action={
            <Link href="/sms-vendors">
              <Button variant="secondary">Back to Vendors</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={vendor.vendorName}
        description={`Payee: ${vendor.payeeMomoNumber} • WhatsApp: ${vendor.whatsappE164}`}
        meta={
          <Badge variant={STATUS_BADGE_VARIANTS[vendor.subscriptionStatus] ?? "gray"}>
            {vendor.subscriptionStatus}
          </Badge>
        }
        actions={
          <div className="flex gap-2">
            {vendor.subscriptionStatus === "pending" && (
              <Button
                variant="success"
                onClick={handleActivate}
                loading={updateMutation.isPending}
              >
                Activate
              </Button>
            )}
            {vendor.subscriptionStatus === "active" && (
              <Button
                variant="danger"
                onClick={handleSuspend}
                loading={updateMutation.isPending}
              >
                Suspend
              </Button>
            )}
            {vendor.subscriptionStatus === "suspended" && (
              <Button
                variant="success"
                onClick={handleActivate}
                loading={updateMutation.isPending}
              >
                Reactivate
              </Button>
            )}
            <Link href="/sms-vendors">
              <Button variant="secondary">Back</Button>
            </Link>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Transactions</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {stats?.totalTransactions ?? 0}
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Total Revenue</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrency(stats?.totalRevenue ?? 0)}
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--aurora-text-secondary)]">Unique Payers</p>
          <p className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {stats?.uniquePayers ?? 0}
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
      </div>

      {/* Vendor Info */}
      <SectionCard
        title="Vendor Information"
        description="Details and API credentials for this vendor."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCredentials(!showCredentials)}
          >
            {showCredentials ? "Hide Credentials" : "Show Credentials"}
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
              Vendor Name
            </label>
            <p className="text-[var(--aurora-text-primary)]">{vendor.vendorName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
              Subscription Status
            </label>
            <Badge variant={STATUS_BADGE_VARIANTS[vendor.subscriptionStatus] ?? "gray"}>
              {vendor.subscriptionStatus}
            </Badge>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
              Payee MoMo Number
            </label>
            <p className="text-[var(--aurora-text-primary)]">{vendor.payeeMomoNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
              WhatsApp Number
            </label>
            <p className="text-[var(--aurora-text-primary)]">{vendor.whatsappE164}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
              Created At
            </label>
            <p className="text-[var(--aurora-text-primary)]">{formatDate(vendor.createdAt)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
              Activated At
            </label>
            <p className="text-[var(--aurora-text-primary)]">{formatDate(vendor.activatedAt)}</p>
          </div>
          {vendor.notes && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                Notes
              </label>
              <p className="text-[var(--aurora-text-primary)]">{vendor.notes}</p>
            </div>
          )}
        </div>

        {showCredentials && (
          <div className="mt-6 pt-6 border-t border-[var(--aurora-border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--aurora-text-primary)]">
                API Credentials
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerateKey}
                loading={regenerateMutation.isPending}
              >
                Regenerate Keys
              </Button>
            </div>
            <div className="space-y-4 bg-[var(--aurora-surface)] rounded-lg p-4 border border-[var(--aurora-border)]">
              <div>
                <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                  API Key
                </label>
                <code className="block text-sm bg-[var(--aurora-surface-elevated)] p-3 rounded border border-[var(--aurora-border)] font-mono text-[var(--aurora-text-primary)] break-all">
                  {vendor.apiKey}
                </code>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--aurora-text-secondary)] mb-1">
                  HMAC Secret
                </label>
                <code className="block text-sm bg-[var(--aurora-surface-elevated)] p-3 rounded border border-[var(--aurora-border)] font-mono text-[var(--aurora-text-primary)] break-all">
                  {vendor.hmacSecret.slice(0, 8)}...{vendor.hmacSecret.slice(-8)}
                </code>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Recent Transactions */}
      <SectionCard
        title="Recent Transactions"
        description="Last 50 transactions from this vendor."
      >
        {transactionsQuery.isLoading ? (
          <LoadingState title="Loading transactions" description="Fetching transaction data..." />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Transactions will appear here once the vendor starts receiving SMS payments."
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
        )}
      </SectionCard>

      {/* Top Payers */}
      <SectionCard
        title="Top Payers"
        description="Payers with the highest total payments."
      >
        {ledgersQuery.isLoading ? (
          <LoadingState title="Loading payers" description="Fetching payer data..." />
        ) : topPayers.length === 0 ? (
          <EmptyState
            title="No payers yet"
            description="Payer ledgers will appear here once the vendor starts receiving payments."
          />
        ) : (
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
                    Last Payment
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPayers.map((payer) => (
                  <tr key={payer.id} className="border-b border-[var(--aurora-border)]">
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
                      {formatDate(payer.lastPaymentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard
        title="Danger Zone"
        description="Irreversible actions for this vendor."
      >
        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
          <div>
            <p className="font-medium text-red-700">Delete Vendor</p>
            <p className="text-sm text-red-600">
              Permanently delete this vendor and all associated data.
            </p>
          </div>
          {confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                Confirm Delete
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete Vendor
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
