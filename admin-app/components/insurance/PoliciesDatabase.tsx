"use client";

import { type ComponentProps,useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";
// Live data only; no mock imports

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

type PolicyMock = { id: string; quoteId?: string | null; policyNumber?: string | null; insurer: string; status: string; effectiveFrom?: string | null; effectiveTo?: string | null; premiumTotalMinor?: number | null; breakdown: Array<{ id: string; label: string; amountMinor: number }>; customerName?: string | null; customerPhone?: string | null; vehiclePlate?: string | null };
type RequestMock = { id: string; customerName?: string; customerMsisdn?: string; vehicle?: { plateNumber?: string | null } | null };

interface PolicyDetail {
  policy: PolicyMock;
  request: RequestMock | undefined;
}

const statusVariant: Record<PolicyMock["status"], ComponentProps<typeof Badge>["variant"]> = {
  draft: "outline",
  pending_issue: "warning",
  active: "success",
  expired: "default",
  cancelled: "destructive",
};

export function PoliciesDatabase() {
  const [selected, setSelected] = useState<PolicyDetail | null>(null);
  const [policies, setPolicies] = useState<PolicyMock[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(page * PAGE_SIZE));
        const res = await fetch(`/api/insurance/policies${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load policies");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        const mapped: PolicyMock[] = data.map((p: any) => ({
          id: String(p.id),
          quoteId: p.quoteId ?? p.quote_id ?? null,
          policyNumber: p.policyNumber ?? p.policy_number ?? null,
          insurer: p.insurer ?? "",
          status: p.status ?? "draft",
          effectiveFrom: p.effectiveAt ?? p.effective_at ?? null,
          effectiveTo: p.expiresAt ?? p.expires_at ?? null,
          premiumTotalMinor: p.premium ?? null,
          breakdown: [],
          // Enriched fields
          customerName: p.customerName ?? null,
          customerPhone: p.customerPhone ?? null,
          vehiclePlate: p.vehiclePlate ?? null,
        }));
        if (mounted) setPolicies(mapped);
      } catch {
        if (mounted) setPolicies([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [statusFilter, page]);

  return (
    <SectionCard
      title="Policies database"
      description="Central repository for issued policies, breakdowns, and metadata synced from Supabase."
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
            <option value="draft">Draft</option>
            <option value="pending_issue">Pending issue</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policy/quote id"
          className="min-w-[220px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-sm"
        />
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            type="button"
            className="rounded border border-[color:var(--color-border)] px-3 py-1 disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            className="rounded border border-[color:var(--color-border)] px-3 py-1"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Policy</th>
              <th className="px-4 py-3 text-left">Quote</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-left">Insurer</th>
              <th className="px-4 py-3 text-left">Effective dates</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {policies
              .filter((p) => (search.trim() ? (p.policyNumber ?? "").includes(search) || (p.quoteId ?? "").includes(search) : true))
              .map((policy) => {
              const request = undefined as unknown as RequestMock | undefined;
              return (
                <tr
                  key={policy.id}
                  className="cursor-pointer hover:bg-[color:var(--color-border)]/20"
                  onClick={() => setSelected({ policy, request })}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{policy.policyNumber ?? policy.id}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">
                      {request?.vehicle?.plateNumber ?? "Unlinked"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {policy.quoteId ? (
                      <a
                        href={`/insurance/comparisons?search=${encodeURIComponent(policy.quoteId)}`}
                        className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {policy.quoteId}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{policy.customerName ?? request?.customerName ?? "—"}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">{policy.customerPhone ?? request?.customerMsisdn ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">{policy.vehiclePlate ?? request?.vehicle?.plateNumber ?? "—"}</td>
                  <td className="px-4 py-3">{policy.insurer}</td>
                  <td className="px-4 py-3">
                    {policy.effectiveFrom
                      ? `${new Date(policy.effectiveFrom).toLocaleDateString()} → ${policy.effectiveTo ? new Date(policy.effectiveTo).toLocaleDateString() : "TBD"}`
                      : "Awaiting issuance"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[policy.status]}>
                      {policy.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {!policies.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                  {loading ? "Loading…" : "No policies found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer
          title={`Policy ${selected.policy.policyNumber ?? selected.policy.id}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Customer</p>
              <p className="font-medium">{selected.request?.customerName ?? "Unknown"}</p>
              <p className="text-xs text-[color:var(--color-muted)]">{selected.request?.customerMsisdn ?? ""}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Breakdown</p>
              <ul className="space-y-1 pt-2">
            {selected.policy.breakdown.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.label}</span>
                    <span>{formatCurrency(item.amountMinor)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Metadata</p>
              <ul className="space-y-1 pt-2">
                <li className="flex justify-between">
                  <span>Insurer</span>
                  <span>{selected.policy.insurer}</span>
                </li>
                <li className="flex justify-between">
                  <span>Premium total</span>
                  <span>{formatCurrency(selected.policy.premiumTotalMinor ?? 0)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Status</span>
                  <Badge variant={statusVariant[selected.policy.status]}>
                    {selected.policy.status}
                  </Badge>
                </li>
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
