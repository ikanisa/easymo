"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
// Live data only; no mock imports

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

type RequestRow = {
  id: string;
  status: string;
  vehiclePlate: string | null;
  createdAt: string;
};
type PaymentMock = { id: string; intentId?: string | null; status: string; amount: number };
type TaskMock = { id: string; requestId: string; title: string; status: string; dueAt?: string | null };

const statusVariant: Record<string, ComponentProps<typeof Badge>["variant"]> = {
  draft: "outline",
  intake: "outline",
  under_review: "warning",
  quoted: "default",
  awaiting_payment: "warning",
  paid: "success",
  issued: "success",
  cancelled: "destructive",
};

interface RequestDetail {
  id: string;
  status: string;
  customerName?: string;
  customerMsisdn?: string;
  vehicle?: { plateNumber?: string | null } | null;
  comparison: Array<{ insurer: string; grossPremiumMinor: number }>;
  outstandingMinor: number;
  overdueTasks: number;
}

function deriveOutstanding(_request: RequestRow): number {
  return 0;
}

function deriveOverdueTasks(_request: RequestRow): number {
  return 0;
}

export function RequestsDatabase() {
  const [selected, setSelected] = useState<RequestDetail | null>(null);
  const [rows, setRows] = useState<RequestDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/insurance/requests${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load requests");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        const mapped: RequestDetail[] = data.map((r: any) => ({
          id: String(r.id),
          status: String(r.status ?? ""),
          customerName: String(r.contactId ?? "—"),
          customerMsisdn: "",
          vehicle: { plateNumber: r.vehiclePlate ?? r.vehicle_plate ?? null } as any,
          comparison: [],
          outstandingMinor: 0,
          overdueTasks: 0,
        }));
        if (mounted) setRows(mapped);
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [statusFilter, search]);

  return (
    <SectionCard
      title="Requests database"
      description="Full history of insurance requests with outstanding balances, tasks, and comparisons."
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
            <option value="collecting">Collecting</option>
            <option value="under_review">Under review</option>
            <option value="quoted">Quoted</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="paid">Paid</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plate/notes"
          className="min-w-[220px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Request</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Outstanding</th>
              <th className="px-4 py-3 text-left">Tasks overdue</th>
              <th className="px-4 py-3 text-left">Quotes</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.id}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{row.vehicle?.plateNumber ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.customerName}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{row.customerMsisdn}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[row.status]}>{row.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="px-4 py-3">{row.outstandingMinor ? formatCurrency(row.outstandingMinor) : "—"}</td>
                <td className="px-4 py-3">{row.overdueTasks}</td>
                <td className="px-4 py-3">{row.comparison.length}</td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                    Open
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                  {loading ? "Loading…" : "No requests found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer title={`Request ${selected.id}`} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Status</p>
              <Badge variant={statusVariant[selected.status]}>{selected.status}</Badge>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Payments</p>
              <ul className="space-y-1 pt-2">
                <li className="text-[color:var(--color-muted)]">No payments data.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Tasks</p>
              <ul className="space-y-1 pt-2">
                <li className="text-[color:var(--color-muted)]">No tasks data.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Quotes</p>
              <ul className="space-y-1 pt-2">
                {selected.comparison.map((quote) => (
                  <li key={quote.insurer} className="flex justify-between">
                    <span>{quote.insurer}</span>
                    <span>{formatCurrency(quote.grossPremiumMinor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
