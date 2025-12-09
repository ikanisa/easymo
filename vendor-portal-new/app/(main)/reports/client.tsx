"use client";

import { useCallback, useMemo, useState } from "react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { ReportFilters, type ReportFiltersChange } from "@/components/reports/report-filters";
import { ReportExportPanel } from "@/components/reports/report-export-panel";
import { ReportPreview, type ReportPreviewSummary } from "@/components/reports/report-preview";
import { ReportSubscriptionsCard } from "@/components/reports/report-subscriptions-card";
import type { SaccoSearchResult } from "@/components/saccos/sacco-search-combobox";
import { useTranslation } from "@/providers/i18n-provider";
import type { ReportSubscription } from "./types";

interface ReportsClientProps {
  initialSacco: SaccoSearchResult | null;
  ikiminaCount: number;
  saccoOptions: SaccoSearchResult[];
  subscriptions: ReportSubscription[];
  isSystemAdmin: boolean;
  profileSaccoId: string | null;
}

export function ReportsClient({
  initialSacco,
  ikiminaCount,
  saccoOptions,
  subscriptions,
  isSystemAdmin,
  profileSaccoId,
}: ReportsClientProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ReportFiltersChange>({
    sacco: initialSacco,
    from: "",
    to: "",
  });
  const [previewSummary, setPreviewSummary] = useState<ReportPreviewSummary | null>(null);

  const handleFiltersChange = useCallback((next: ReportFiltersChange) => {
    setFilters(next);
  }, []);

  const exportContext = useMemo(() => ({ ...filters }), [filters]);

  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<span>{t("reports.title", "Reports")}</span>}
        subtitle={
          <span className="text-xs text-ink/70">
            {t(
              "reports.subtitle",
              "Generate branded exports for SACCO leadership, auditors, and members."
            )}
          </span>
        }
        badge={
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-ink">
            {t("reports.badge.pwa", "PWA-ready")}
          </span>
        }
      />

      <GlassCard
        title={<span>{t("reports.summary.title", "Summary")}</span>}
        subtitle={
          <span className="text-xs text-neutral-3">
            {previewSummary
              ? t("reports.summary.ready", "Figures reflect the applied filters.")
              : t("reports.summary.pending", "Adjust filters to populate the summary.")}
          </span>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryTile
            label={t("reports.cards.totalVolume", "Total volume")}
            value={
              previewSummary
                ? formatCurrency(previewSummary.totalAmount, previewSummary.currency)
                : "—"
            }
          />
          <SummaryTile
            label={t("reports.cards.transactions", "Transactions")}
            value={previewSummary ? String(previewSummary.totalTransactions) : "—"}
          />
          <SummaryTile
            label={t("reports.cards.uniqueIkimina", "Unique ikimina")}
            value={previewSummary ? String(previewSummary.uniqueIkimina) : "—"}
          />
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <GlassCard
          title={<span>{t("reports.filters.title", "Filters")}</span>}
          subtitle={
            <span className="text-xs text-neutral-3">
              {t("reports.filters.subtitle", "Fine-tune the reporting scope.")}
            </span>
          }
        >
          <ReportFilters initialSacco={initialSacco} onChange={handleFiltersChange} />
        </GlassCard>

        <GlassCard
          title={<span>{t("reports.preview.title", "Preview")}</span>}
          subtitle={
            <span className="text-xs text-neutral-3">
              {t("reports.preview.subtitle", "Review performance before exporting.")}
            </span>
          }
          className="min-h-[320px] space-y-6"
        >
          <ReportPreview filters={exportContext} onSummaryChange={setPreviewSummary} />
          <div className="border-t border-white/10 pt-6">
            <ReportExportPanel
              filters={exportContext}
              ikiminaCount={previewSummary?.uniqueIkimina ?? ikiminaCount}
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard
        title={<span>{t("reports.automations.title", "Scheduled exports")}</span>}
        subtitle={
          <span className="text-xs text-neutral-3">
            {t("reports.automations.subtitle", "Deliver recurring reports to leadership.")}
          </span>
        }
      >
        <ReportSubscriptionsCard
          filters={exportContext}
          subscriptions={subscriptions}
          saccoOptions={saccoOptions}
          isSystemAdmin={isSystemAdmin}
          defaultSaccoId={initialSacco?.id ?? profileSaccoId}
        />
      </GlassCard>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-glass">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-neutral-0">{value}</p>
    </div>
  );
}
