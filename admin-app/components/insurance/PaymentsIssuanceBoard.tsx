"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
// Live data only; no mock imports

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

type InsurancePayment = { id: string; status: string; amount: number; reference?: string | null; recordedAt?: string | null; intentId?: string | null; quoteId?: string | null };

const paymentStatusVariant: Record<string, ComponentProps<typeof Badge>["variant"]> = {
  pending: "warning",
  in_review: "outline",
  completed: "success",
  failed: "destructive",
  refunded: "default",
};

export function PaymentsIssuanceBoard() {
  const [payments, setPayments] = useState<InsurancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/insurance/payments${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load payments");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        const mapped: InsurancePayment[] = data.map((p: any) => ({
          id: String(p.id),
          status: String(p.status ?? "pending"),
          amount: Number(p.amount ?? 0),
          reference: p.reference ?? null,
          recordedAt: p.recordedAt ?? p.recorded_at ?? null,
          intentId: p.intentId ?? p.intent_id ?? null,
          quoteId: p.quoteId ?? p.quote_id ?? null,
        }));
        if (mounted) setPayments(mapped);
      } catch {
        if (mounted) setPayments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [statusFilter]);

  return (
    <SectionCard
      title="Payments"
      description="Recent insurance payments from Supabase."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-sm">
          <label className="text-[color:var(--color-muted)]">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id/reference"
          className="min-w-[220px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-sm"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Recorded</th>
              <th className="px-4 py-3 text-left">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {payments
              .filter((p) =>
                search.trim()
                  ? p.id.toLowerCase().includes(search.toLowerCase()) || (p.reference ?? "").toLowerCase().includes(search.toLowerCase())
                  : true,
              )
              .map((p) => (
              <tr key={p.id} className="hover:bg-[color:var(--color-border)]/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{p.id}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{p.reference ?? "—"}</div>
                </td>
                <td className="px-4 py-3">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3">
                  <Badge variant={paymentStatusVariant[p.status] ?? "outline"}>
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3">{p.recordedAt ? new Date(p.recordedAt).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 space-x-2">
                  {p.intentId ? (
                    <a
                      href={`/insurance/requests?search=${encodeURIComponent(p.intentId)}`}
                      className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                    >
                      Request
                    </a>
                  ) : null}
                  {p.quoteId ? (
                    <a
                      href={`/insurance/comparisons?search=${encodeURIComponent(p.quoteId)}`}
                      className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                    >
                      Quote
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[color:var(--color-muted)]">{loading ? "Loading…" : "No payments found."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
