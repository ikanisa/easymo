"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface CandidateSummary {
  id: string;
  name?: string | null;
  price?: number | null;
  currency?: string | null;
  etaMinutes?: number | null;
  status?: string | null;
  score?: number | null;
  notes?: string | null;
}

interface CandidateCompare3Props {
  candidates: CandidateSummary[];
  selectedId?: string | null;
  onSelect?: (candidateId: string) => void;
  isLoading?: boolean;
}

function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount === undefined || amount === null) return "–";
  const currencyCode = currency ?? "RWF";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    console.warn("currency_format_failed", error);
    return `${amount} ${currencyCode}`;
  }
}

export function CandidateCompare3({ candidates, selectedId, onSelect, isLoading }: CandidateCompare3Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top driver offers</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState title="Loading candidate quotes" description="Pulling pricing and ETA estimates." />
        </CardContent>
      </Card>
    );
  }

  if (!candidates.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top driver offers</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No driver quotes yet"
            description="We’ll surface the first three offers here as soon as vendors respond."
          />
        </CardContent>
      </Card>
    );
  }

  const sorted = [...candidates]
    .sort((a, b) => {
      const priceA = a.price ?? Number.POSITIVE_INFINITY;
      const priceB = b.price ?? Number.POSITIVE_INFINITY;
      if (priceA !== priceB) return priceA - priceB;
      const etaA = a.etaMinutes ?? Number.POSITIVE_INFINITY;
      const etaB = b.etaMinutes ?? Number.POSITIVE_INFINITY;
      return etaA - etaB;
    })
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">
          Top driver offers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {sorted.map((candidate, index) => {
            const isBest = index === 0;
            const isSelected = selectedId === candidate.id;
            const statusLabel = candidate.status?.replace(/_/g, " ") ?? "pending";
            return (
              <button
                type="button"
                key={candidate.id}
                onClick={() => onSelect?.(candidate.id)}
                className={cn(
                  "group flex h-full flex-col rounded-xl border p-4 text-left transition",
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md dark:border-blue-400/80 dark:bg-blue-500/10"
                    : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {candidate.name ?? "Unnamed driver"}
                  </div>
                  <Badge variant={isBest ? "green" : "blue"}>{isBest ? "Best value" : `Rank #${index + 1}`}</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fare</span>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(candidate.price ?? undefined, candidate.currency ?? undefined)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>ETA</span>
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {candidate.etaMinutes != null ? `${candidate.etaMinutes} min` : "–"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Status: <span className="capitalize text-slate-700 dark:text-slate-200">{statusLabel}</span>
                  </div>
                  {candidate.notes ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{candidate.notes}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
