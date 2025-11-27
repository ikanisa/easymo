"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";

type QuoteRow = {
  id: string;
  intentId: string | null;
  insurer: string | null;
  status: string;
  premium: number | null;
};

function formatCurrencyRW(minor?: number | null) {
  try {
    return typeof minor === "number"
      ? new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(Math.round(minor))
      : "—";
  } catch {
    return minor ?? "—";
  }
}

export function InsuranceComparisonsBoard() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ intentId: string; quotes: QuoteRow[] } | null>(null);
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string | "all">(
    (searchParams?.get("status") as any) || "all",
  );
  const [search, setSearch] = useState(
    searchParams?.get("search") || searchParams?.get("intentId") || "",
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (search.trim()) params.set("search", search.trim());
        const res = await fetch(`/api/insurance/quotes?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load quotes");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        const mapped: QuoteRow[] = data.map((q: any) => ({
          id: String(q.id),
          intentId: q.intentId ?? q.intent_id ?? null,
          insurer: q.insurer ?? null,
          status: q.status ?? "pending",
          premium: q.premium === null || q.premium === undefined ? null : Number(q.premium),
        }));
        if (mounted) setQuotes(mapped);
      } catch {
        if (mounted) setQuotes([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [statusFilter, search]);

  const groups = useMemo(() => {
    const byIntent = new Map<string, QuoteRow[]>();
    for (const q of quotes) {
      const key = q.intentId ?? "unassigned";
      if (!byIntent.has(key)) byIntent.set(key, []);
      byIntent.get(key)!.push(q);
    }
    return Array.from(byIntent.entries()).map(([intentId, list]) => {
      const premiums = list.map((q) => q.premium).filter((n): n is number => typeof n === "number");
      const min = premiums.length ? Math.min(...premiums) : null;
      const max = premiums.length ? Math.max(...premiums) : null;
      return {
        intentId,
        quotes: list,
        bestPremium: min,
        spread: min !== null && max !== null ? max - min : null,
      };
    });
  }, [quotes]);

  return (
    <SectionCard
      title="Quote comparisons"
      description="Best offers per request and spread across insurers."
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
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search insurer/ID"
          className="min-w-[220px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-sm"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <button
            key={g.intentId}
            type="button"
            onClick={() => setSelected({ intentId: g.intentId, quotes: g.quotes })}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left hover:border-[color:var(--color-accent)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Intent</p>
                <p className="text-lg font-semibold">{g.intentId}</p>
              </div>
              <Badge variant="outline">{g.quotes.length} quotes</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-muted)]">Best premium</span>
                <span className="font-semibold">{formatCurrencyRW(g.bestPremium)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-muted)]">Spread</span>
                <span>{formatCurrencyRW(g.spread)}</span>
              </div>
              <div className="pt-2 text-xs">
                <a
                  href={`/insurance/documents?intentId=${encodeURIComponent(g.intentId)}`}
                  className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View documents →
                </a>
              </div>
            </div>
          </button>
        ))}
        {!groups.length && (
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4 text-sm text-[color:var(--color-muted)]">
            {loading ? "Loading…" : "No quotes found."}
          </div>
        )}
      </div>

      {selected && (
        <Drawer title={`Quotes for ${selected.intentId}`} onClose={() => setSelected(null)}>
          <div className="space-y-2 text-sm">
            {selected.quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] p-2">
                <div>
                  <p className="font-medium">{q.insurer ?? "—"}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{q.status}</p>
                </div>
                <div className="font-semibold">{formatCurrencyRW(q.premium)}</div>
              </div>
            ))}
            <div className="pt-2 text-xs">
              <a
                href={`/insurance/documents?intentId=${encodeURIComponent(selected.intentId)}`}
                className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
              >
                View documents for this request →
              </a>
              <span className="mx-2 text-[color:var(--color-muted)]">|</span>
              <a
                href={`/insurance/policies?search=${encodeURIComponent(selected.quotes[0]?.id ?? "")}`}
                className="text-[color:var(--color-accent)] underline-offset-2 hover:underline"
              >
                Find policy by best quote →
              </a>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
