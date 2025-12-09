"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import type { ReportExportFilters } from "@/components/reports/report-export-panel";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_BARS = 14;

export interface ReportPreviewSummary {
  currency: string;
  totalAmount: number;
  totalTransactions: number;
  uniqueIkimina: number;
}

interface ReportPreviewProps {
  filters: ReportExportFilters;
  onSummaryChange?: (summary: ReportPreviewSummary | null) => void;
}

interface ReportPreviewData extends ReportPreviewSummary {
  topIkimina: Array<{
    id: string;
    name: string;
    code: string;
    amount: number;
    transactionCount: number;
  }>;
  dailyTotals: Array<{
    date: string;
    amount: number;
  }>;
}

type PreviewResponse = {
  summary: ReportPreviewData | null;
  brandColor: string | null;
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ReportPreview({ filters, onSummaryChange }: ReportPreviewProps) {
  const { t } = useTranslation();
  const { error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<ReportPreviewData | null>(null);
  const [brandColor, setBrandColor] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setErrorMessage(null);
      onSummaryChange?.(null);

      const now = new Date();
      const defaultStart = new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const startDate = filters.from ? new Date(`${filters.from}T00:00:00`) : defaultStart;
      const endDate = filters.to ? new Date(`${filters.to}T00:00:00`) : now;

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setErrorMessage(t("reports.errors.invalidDates", "Invalid date filters"));
        setData(null);
        setLoading(false);
        return;
      }

      if (startDate > endDate) {
        setErrorMessage(t("reports.errors.startBeforeEnd", "Start date must be before end date"));
        setData(null);
        setLoading(false);
        return;
      }

      let response: Response;
      let payload: PreviewResponse | { error?: string } = {};

      try {
        response = await fetch("/api/reports/preview", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            saccoId: filters.sacco?.id ?? null,
            from: filters.from || undefined,
            to: filters.to || undefined,
          }),
        });
        payload = (await response.json().catch(() => ({}))) as PreviewResponse | { error?: string };
      } catch (error) {
        if ((error as DOMException | Error)?.name === "AbortError") {
          return;
        }
        const message = t("reports.errors.loadFailed", "Failed to load preview");
        if (!cancelled) {
          setErrorMessage(message);
          setData(null);
          toastError(message);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      if (!response.ok) {
        const message =
          (payload as { error?: string }).error ??
          t("reports.errors.loadFailed", "Failed to load preview");
        setErrorMessage(message);
        setData(null);
        toastError(message);
        setLoading(false);
        return;
      }

      const { summary, brandColor: nextBrandColor } = payload as PreviewResponse;
      setBrandColor(nextBrandColor ?? null);

      if (!summary) {
        setData(null);
        onSummaryChange?.({
          currency: "RWF",
          totalAmount: 0,
          totalTransactions: 0,
          uniqueIkimina: 0,
        });
        setLoading(false);
        return;
      }

      const trimmed: ReportPreviewData = {
        currency: summary.currency,
        totalAmount: summary.totalAmount,
        totalTransactions: summary.totalTransactions,
        uniqueIkimina: summary.uniqueIkimina,
        topIkimina: summary.topIkimina.slice(0, 5),
        dailyTotals: summary.dailyTotals.slice(-MAX_BARS),
      };

      setData(trimmed);
      onSummaryChange?.({
        currency: summary.currency,
        totalAmount: summary.totalAmount,
        totalTransactions: summary.totalTransactions,
        uniqueIkimina: summary.uniqueIkimina,
      });
      setLoading(false);
    }

    loadPreview();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters.from, filters.to, filters.sacco?.id, onSummaryChange, toastError, t]);

  const maxDailyAmount = useMemo(() => {
    if (!data || data.dailyTotals.length === 0) return 0;
    return Math.max(...data.dailyTotals.map((entry) => entry.amount));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        {errorMessage}
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title={t("reports.empty.title", "No data in range")}
        description={t(
          "reports.empty.description",
          "Adjust the filters or select a SACCO to generate a preview."
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-glass">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("reports.cards.totalVolume", "Total volume")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-0">
            {formatCurrency(data.totalAmount, data.currency)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-glass">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("reports.cards.transactions", "Transactions")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-0">{data.totalTransactions}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-glass">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("reports.cards.uniqueIkimina", "Unique ikimina")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-0">{data.uniqueIkimina}</p>
        </article>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-3">
            {t("reports.chart.dailyTotals", "Daily totals")}
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-3">
            {data.dailyTotals.length} {t("reports.chart.daysSuffix", "days")}
          </span>
        </div>
        {data.dailyTotals.length === 0 ? (
          <p className="mt-4 text-xs text-neutral-2">
            {t("reports.chart.noPosted", "No posted transactions in this window.")}
          </p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-2">
            {data.dailyTotals.map((entry) => {
              const barHeight =
                maxDailyAmount > 0
                  ? Math.max(8, Math.round((entry.amount / maxDailyAmount) * 100))
                  : 8;
              return (
                <div
                  key={entry.date}
                  className="flex flex-col items-center gap-2 text-[10px] text-neutral-3"
                >
                  <div
                    className="w-5 rounded-t-full"
                    style={{ height: `${barHeight}%`, backgroundColor: brandColor ?? "#0ea5e9" }}
                    aria-label={`${entry.date}: ${formatCurrency(entry.amount, data.currency)}`}
                  />
                  <span>
                    {new Date(entry.date).toLocaleDateString("en-RW", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <span className="text-xs text-neutral-3">
          {t("reports.topIkimina.title", "Top ikimina")}
        </span>
        {data.topIkimina.length === 0 ? (
          <p className="mt-4 text-xs text-neutral-2">
            {t("reports.topIkimina.noActivity", "No ikimina activity captured during this window.")}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-neutral-3">
                <tr>
                  <th className="py-2">{t("reports.table.ikimina", "Ikimina")}</th>
                  <th className="py-2">{t("reports.table.code", "Code")}</th>
                  <th className="py-2 text-right">{t("reports.table.amount", "Amount")}</th>
                  <th className="py-2 text-right">{t("reports.table.share", "Share")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.topIkimina.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-neutral-0">{item.name}</td>
                    <td className="py-2 text-neutral-2">{item.code}</td>
                    <td className="py-2 text-right text-neutral-0">
                      {formatCurrency(item.amount, data.currency)}
                    </td>
                    <td className="py-2 text-right text-neutral-2">
                      {data.totalAmount > 0
                        ? `${Math.round((item.amount / data.totalAmount) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
