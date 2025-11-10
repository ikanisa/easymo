"use client";

import { useMemo, useState } from "react";
import type { MarketplaceAgentSession, MarketplaceQuote } from "@/lib/marketplace/types";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Badge } from "@/components/ui/Badge";

interface MarketplaceQuoteComparisonProps {
  sessions: MarketplaceAgentSession[];
  isLoading?: boolean;
  agentLabel: string;
}

interface QuoteInsight {
  quote: MarketplaceQuote;
  session: MarketplaceAgentSession;
  totalMinor: number | null;
}

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function extractQuotes(sessions: MarketplaceAgentSession[]): QuoteInsight[] {
  return sessions.flatMap((session) =>
    session.quotes.map((quote) => ({
      quote,
      session,
      totalMinor:
        typeof (quote.offerData as any)?.total_minor === "number"
          ? Number((quote.offerData as any).total_minor)
          : null,
    })),
  );
}

export function MarketplaceQuoteComparison({ sessions, isLoading, agentLabel }: MarketplaceQuoteComparisonProps) {
  const [selected, setSelected] = useState<QuoteInsight | null>(null);

  const { bestQuotes, totalQuotes } = useMemo(() => {
    const quotes = extractQuotes(sessions);
    const sorted = quotes
      .slice()
      .sort((a, b) => (a.totalMinor ?? Number.POSITIVE_INFINITY) - (b.totalMinor ?? Number.POSITIVE_INFINITY));
    return {
      bestQuotes: sorted.slice(0, 4),
      totalQuotes: quotes.length,
    };
  }, [sessions]);

  if (isLoading) {
    return <LoadingState title="Loading quotes" description="Fetching structured offers from Supabase." />;
  }

  if (!sessions.length) {
    return (
      <EmptyState
        title={`No ${agentLabel.toLowerCase()} sessions yet`}
        description="Launch a sourcing request using the wizard to populate vendor comparisons."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">Quote comparison</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            Snapshot of the most competitive offers pulled from active {agentLabel.toLowerCase()} sessions.
          </p>
        </div>
        <Badge variant="outline">{totalQuotes} quotes</Badge>
      </div>
      {bestQuotes.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {bestQuotes.map((insight) => (
            <button
              key={insight.quote.id}
              type="button"
              onClick={() => setSelected(insight)}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-left shadow-sm transition hover:border-[color:var(--color-accent)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                    {insight.session.customer.msisdn ?? "Customer"}
                  </p>
                  <p className="text-base font-semibold text-[color:var(--color-foreground)]">
                    {insight.quote.vendorName ?? "Unknown vendor"}
                  </p>
                </div>
                <Badge variant="blue">{insight.session.status}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[color:var(--color-muted)]">Total</p>
                  <p className="font-semibold text-[color:var(--color-foreground)]">
                    {insight.totalMinor ? currencyFormatter.format(insight.totalMinor) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[color:var(--color-muted)]">Responded</p>
                  <p className="font-semibold text-[color:var(--color-foreground)]">
                    {insight.quote.respondedAt ? new Date(insight.quote.respondedAt).toLocaleTimeString() : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-[color:var(--color-muted)]">
                {(insight.quote.offerData as any)?.notes ?? "Tap to review the full structured offer."}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No structured quotes"
          description="Waiting on vendor callbacks. Refresh once the marketplace agent finishes sourcing."
        />
      )}

      {selected ? (
        <Drawer
          title={`${selected.quote.vendorName ?? "Vendor"} · ${selected.session.customer.msisdn ?? selected.session.id}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4 text-sm">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Offer breakdown</h4>
              <ul className="mt-2 space-y-1">
                {Object.entries(selected.quote.offerData ?? {}).map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-4">
                    <span className="capitalize text-[color:var(--color-muted)]">{key.replace(/_/g, " ")}</span>
                    <span className="text-[color:var(--color-foreground)]">
                      {typeof value === "number" ? value.toLocaleString("en-RW") : String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Session context</h4>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between gap-4">
                  <dt className="text-[color:var(--color-muted)]">Status</dt>
                  <dd className="text-[color:var(--color-foreground)] capitalize">{selected.session.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[color:var(--color-muted)]">Started</dt>
                  <dd className="text-[color:var(--color-foreground)]">
                    {new Date(selected.session.startedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
