"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { Trans } from "@/components/common/trans";

interface TapMoMoTransactionsListProps {
  saccoId?: string;
}

interface Transaction {
  id: string;
  merchant_name: string;
  merchant_code: string;
  amount: number | null;
  currency: string;
  ref: string | null;
  network: string;
  status: string;
  payer_hint: string | null;
  initiated_at: string;
  settled_at: string | null;
  payment_reference: string | null;
}

export function TapMoMoTransactionsList({ saccoId }: TapMoMoTransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (saccoId) params.append("sacco_id", saccoId);

      const response = await fetch(`/api/tapmomo/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to load transactions");

      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();

    // Poll for updates every 30 seconds
    const interval = setInterval(loadTransactions, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saccoId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "settled":
        return "success";
      case "initiated":
        return "info";
      case "pending":
        return "warning";
      case "failed":
      case "expired":
        return "critical";
      default:
        return "info";
    }
  };

  return (
    <GlassCard
      title={<Trans i18nKey="tapmomo.transactions.title" fallback="Recent Transactions" />}
      subtitle={
        <Trans
          i18nKey="tapmomo.transactions.subtitle"
          fallback="History of TapMoMo NFC payments"
          className="text-xs text-neutral-3"
        />
      }
    >
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500/20 border-t-primary-500"></div>
          <p className="mt-4 text-sm text-neutral-3">
            <Trans i18nKey="tapmomo.transactions.loading" fallback="Loading transactions..." />
          </p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-neutral-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-sm text-neutral-2">
            <Trans i18nKey="tapmomo.transactions.empty" fallback="No transactions yet" />
          </p>
          <p className="mt-1 text-xs text-neutral-3">
            <Trans
              i18nKey="tapmomo.transactions.emptyHint"
              fallback="Transactions will appear here after NFC payments"
            />
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-neutral-3">
              <tr>
                <th className="px-4 py-3">
                  <Trans i18nKey="tapmomo.transactions.table.merchant" fallback="Merchant" />
                </th>
                <th className="px-4 py-3">
                  <Trans i18nKey="tapmomo.transactions.table.amount" fallback="Amount" />
                </th>
                <th className="px-4 py-3">
                  <Trans i18nKey="tapmomo.transactions.table.network" fallback="Network" />
                </th>
                <th className="px-4 py-3">
                  <Trans i18nKey="tapmomo.transactions.table.status" fallback="Status" />
                </th>
                <th className="px-4 py-3">
                  <Trans i18nKey="tapmomo.transactions.table.date" fallback="Date" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-neutral-0">{tx.merchant_name}</p>
                      <p className="text-xs text-neutral-3">{tx.merchant_code}</p>
                      {tx.ref && <p className="text-xs text-neutral-3">Ref: {tx.ref}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {tx.amount ? (
                      <span className="font-medium text-neutral-0">
                        {tx.amount.toLocaleString()} {tx.currency}
                      </span>
                    ) : (
                      <span className="text-neutral-3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-2">{tx.network}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={getStatusColor(tx.status) as any}>{tx.status}</StatusChip>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <p className="text-neutral-2">
                        {new Date(tx.initiated_at).toLocaleDateString()}
                      </p>
                      <p className="text-neutral-3">
                        {new Date(tx.initiated_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
