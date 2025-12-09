"use client";

import { useMemo, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SaccoSearchResult } from "@/components/saccos/sacco-search-combobox";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";

export interface ReportExportFilters {
  sacco: SaccoSearchResult | null;
  from: string;
  to: string;
}

interface ReportExportPanelProps {
  filters: ReportExportFilters;
  ikiminaCount: number;
}

const supabase = getSupabaseBrowserClient();

export function ReportExportPanel({ filters, ikiminaCount }: ReportExportPanelProps) {
  const { t, locale } = useTranslation();
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [csvSep, setCsvSep] = useState(locale === "fr" ? ";" : ",");

  const saccoLabel = useMemo(() => {
    if (filters.sacco) {
      const location = [filters.sacco.district, filters.sacco.province].filter(Boolean).join(" • ");
      return `${filters.sacco.name}${location ? ` — ${location}` : ""}`;
    }
    return t("sacco.all", "All SACCOs");
  }, [filters.sacco, t]);

  const rangeLabel = useMemo(() => {
    if (filters.from && filters.to) return `${filters.from} → ${filters.to}`;
    if (filters.from) return `${filters.from} → ${t("reports.scope.fromLatest", "(latest)")}`;
    if (filters.to) return `${t("reports.scope.toDefault", "(default)")} → ${filters.to}`;
    return t("reports.scope.defaultRange", "Last 30 days (default)");
  }, [filters.from, filters.to, t]);

  const dateValidation = useMemo(() => {
    const parse = (s?: string) => (s ? new Date(`${s}T00:00:00`) : null);
    const start = parse(filters.from);
    const end = parse(filters.to);
    if (filters.from && (!start || Number.isNaN(start.getTime())))
      return { valid: false as const, reason: "invalid" as const };
    if (filters.to && (!end || Number.isNaN(end.getTime())))
      return { valid: false as const, reason: "invalid" as const };
    if (start && end && start > end) return { valid: false as const, reason: "order" as const };
    return { valid: true as const };
  }, [filters.from, filters.to]);

  const handleExport = (format: "pdf" | "csv") => {
    if (ikiminaCount === 0) {
      setErrorMessage(
        t(
          "reports.export.noData",
          "Select a SACCO or adjust the date range to include ikimina activity."
        )
      );
      return;
    }
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      if (!dateValidation.valid) {
        const msg =
          dateValidation.reason === "order"
            ? t("reports.errors.startBeforeEnd", "Start date must be before end date")
            : t("reports.errors.invalidDates", "Invalid date filters");
        setErrorMessage(msg);
        error(msg);
        return;
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        const msg = sessionError.message ?? t("auth.sessionFailed", "Session lookup failed");
        setErrorMessage(msg);
        error(msg);
        return;
      }

      const token = sessionData.session?.access_token;

      const response = await fetch("/functions/v1/export-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: format === "pdf" ? "application/pdf" : "text/csv",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          saccoId: filters.sacco?.id ?? undefined,
          start: filters.from || undefined,
          end: filters.to || undefined,
          format,
          locale: selectedLocale,
          separator: csvSep,
        }),
      }).catch((fetchError: unknown) => {
        const msg =
          fetchError instanceof Error
            ? fetchError.message
            : t("common.networkError", "Network error");
        setErrorMessage(msg);
        error(msg);
        return null;
      });

      if (!response) {
        return;
      }

      if (!response.ok) {
        const fallback = await response
          .text()
          .catch(() => t("reports.export.failed", "Export failed"));
        setErrorMessage(fallback);
        error(fallback);
        return;
      }

      const blob = await response.blob();
      const fileExt = format === "pdf" ? "pdf" : "csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `ibimina-report-${timestamp}.${fileExt}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const started =
        format === "pdf"
          ? t("reports.export.startedPdf", "PDF export started")
          : t("reports.export.startedCsv", "CSV export started");
      setMessage(started);
      success(started);
    });
  };

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-3 text-sm text-neutral-0">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("common.scope", "Scope")}
          </p>
          <p className="mt-1 font-medium text-neutral-0">{saccoLabel}</p>
          <p className="text-xs text-neutral-2">{rangeLabel}</p>
          {!dateValidation.valid && (
            <p className="mt-1 text-xs text-red-300">
              {dateValidation.reason === "order"
                ? t("reports.errors.startBeforeEnd", "Start date must be before end date")
                : t("reports.errors.invalidDates", "Invalid date filters")}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-neutral-0">
          <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-neutral-2">
              {t("reports.export.localeLabel", "Export locale")}
            </span>
            <select
              className="rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-neutral-0"
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value as typeof selectedLocale)}
            >
              <option value="en">English</option>
              <option value="rw">Kinyarwanda</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-neutral-2">
              {t("reports.export.separatorLabel", "CSV separator")}
            </span>
            <select
              className="rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-neutral-0"
              value={csvSep}
              onChange={(e) => setCsvSep(e.target.value as "," | ";")}
            >
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] text-neutral-3">
            {t(
              "reports.export.brandingHelp",
              "PDF includes SACCO logo/color when available; CSV uses raw values. Date range defaults to last 30 days."
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-3 text-xs text-neutral-2">
          <span>
            {ikiminaCount} {t("reports.export.eligibleSuffix", "ikimina eligible for export.")}
          </span>
          <p className="mt-2 text-[11px] text-neutral-3">
            {t(
              "reports.export.hint",
              "Exports default to the last 30 days when no dates are provided."
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {errorMessage && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
        )}
        {message && (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={pending || ikiminaCount === 0 || !dateValidation.valid}
            className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
          >
            {pending
              ? t("common.exporting", "Exporting…")
              : t("common.downloadPdf", "Download PDF")}
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            disabled={pending || ikiminaCount === 0 || !dateValidation.valid}
            className="interactive-scale rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-0 disabled:opacity-60"
          >
            {pending
              ? t("common.exporting", "Exporting…")
              : t("common.downloadCsv", "Download CSV")}
          </button>
          <button
            type="button"
            onClick={() => {
              // Quick sample CSV (5 rows)
              startTransition(async () => {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                const response = await fetch("/functions/v1/export-report", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "text/csv",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    saccoId: filters.sacco?.id ?? undefined,
                    start: filters.from || undefined,
                    end: filters.to || undefined,
                    format: "csv",
                    locale: selectedLocale,
                    separator: csvSep,
                    limit: 5,
                  }),
                }).catch(() => null);
                if (!response || !response.ok) return;
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "ibimina-report-sample.csv";
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
              });
            }}
            disabled={pending || !dateValidation.valid}
            className="interactive-scale rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-0 disabled:opacity-60"
          >
            {t("reports.export.sampleCsv", "Download sample CSV")}
          </button>
        </div>
      </div>
    </div>
  );
}
