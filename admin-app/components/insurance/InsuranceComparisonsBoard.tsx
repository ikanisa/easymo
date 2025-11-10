"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InsuranceComparisonQuote, InsuranceRequest } from "@/lib/schemas";
import { mockInsuranceRequests } from "@/lib/mock-data";

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

interface ComparisonRow {
  request: InsuranceRequest;
  bestQuote: InsuranceComparisonQuote | null;
  spreadMinor: number | null;
}

function computeRows(requests: InsuranceRequest[]): ComparisonRow[] {
  return requests.map((request) => {
    const sorted = [...request.comparison].sort(
      (a, b) => a.grossPremiumMinor - b.grossPremiumMinor,
    );
    const bestQuote = sorted[0] ?? null;
    const worstQuote = sorted[sorted.length - 1] ?? null;
    const spreadMinor = bestQuote && worstQuote
      ? worstQuote.grossPremiumMinor - bestQuote.grossPremiumMinor
      : null;
    return {
      request,
      bestQuote,
      spreadMinor,
    } satisfies ComparisonRow;
  });
}

export function InsuranceComparisonsBoard() {
  const [selectedQuote, setSelectedQuote] = useState<{
    request: InsuranceRequest;
    quote: InsuranceComparisonQuote;
  } | null>(null);

  const rows = useMemo(() => computeRows(mockInsuranceRequests), []);

  return (
    <SectionCard
      title="Quote comparisons"
      description="Benchmark premiums, turnaround SLAs, and add-on notes across every insurer before escalating to pricing."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(({ request, bestQuote, spreadMinor }) => (
          <div
            key={request.id}
            className="rounded-2xl border border-[color:var(--color-border)] p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {request.customerName}
                </p>
                <p className="text-lg font-semibold">{request.vehicle?.plateNumber ?? request.id}</p>
              </div>
              <Badge variant="outline">{request.status.replace(/_/g, " ")}</Badge>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-muted)]">Best gross premium</span>
                <span className="font-semibold">
                  {bestQuote ? formatCurrency(bestQuote.grossPremiumMinor) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-muted)]">Spread</span>
                <span>{spreadMinor ? formatCurrency(spreadMinor) : "N/A"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-muted)]">Quotes loaded</span>
                <span>{request.comparison.length}</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {request.comparison.map((quote) => (
                <button
                  key={`${request.id}-${quote.insurer}`}
                  onClick={() => setSelectedQuote({ request, quote })}
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-left text-sm transition hover:border-[color:var(--color-accent)]"
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{quote.insurer}</span>
                    <span>{formatCurrency(quote.grossPremiumMinor)}</span>
                  </div>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {quote.product} • {quote.turnaroundHours}h turnaround
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4 text-sm">
        <h3 className="text-sm font-semibold">Ops guidance</h3>
        <p className="mt-2 text-[color:var(--color-muted)]">
          Use this board when coaching agents. Quotes sync from the Supabase `policy_breakdowns` table once confirmed, ensuring pricing, notes, and taxes stay aligned across insurers.
        </p>
        <Button className="mt-3" variant="outline" size="sm">
          Launch quote builder
        </Button>
      </div>

      {selectedQuote && (
        <Drawer
          title={`${selectedQuote.request.vehicle?.plateNumber ?? selectedQuote.request.id} · ${selectedQuote.quote.insurer}`}
          onClose={() => setSelectedQuote(null)}
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Premium breakdown
              </p>
              <ul className="space-y-1 pt-2">
                <li className="flex justify-between">
                  <span>Net premium</span>
                  <span className="font-semibold">{formatCurrency(selectedQuote.quote.netPremiumMinor)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Fees</span>
                  <span>{formatCurrency(selectedQuote.quote.feesMinor)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Taxes</span>
                  <span>{formatCurrency(selectedQuote.quote.taxesMinor)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Gross premium</span>
                  <span className="font-semibold">{formatCurrency(selectedQuote.quote.grossPremiumMinor)}</span>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Underwriting notes
              </p>
              <ul className="list-disc space-y-1 pl-4 pt-2">
                {selectedQuote.quote.notes?.length
                  ? selectedQuote.quote.notes.map((note) => <li key={note}>{note}</li>)
                  : <li>No notes from insurer.</li>}
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
