"use client";

import { useTranslation } from "@/providers/i18n-provider";
import type { ExecutiveAnalyticsSnapshot, RiskLevel } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { RiskSignalsVirtualized } from "@/components/analytics/risk-signals-virtualized";

const currency = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-RW");

const riskTone: Record<RiskLevel, string> = {
  HIGH: "bg-red-500/20 text-red-200 border border-red-400/60",
  MEDIUM: "bg-amber-500/20 text-amber-100 border border-amber-300/60",
  LOW: "bg-emerald-500/15 text-emerald-100 border border-emerald-300/40",
};

interface ExecutiveOverviewProps {
  analytics: ExecutiveAnalyticsSnapshot;
}

function AutomationSummary({ analytics }: ExecutiveOverviewProps) {
  const { t } = useTranslation();
  const cards = [
    {
      label: t("analytics.automation.pendingRecon", "Pending reconciliation"),
      value: analytics.automation.pendingRecon,
    },
    {
      label: t("analytics.automation.queuedNotifications", "Queued notifications"),
      value: analytics.automation.pendingNotifications,
    },
    {
      label: t("analytics.automation.escalations", "Escalations triggered"),
      value: analytics.automation.escalations,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-4 shadow-glass backdrop-blur"
        >
          <span className="text-sm font-semibold text-neutral-0">{card.label}</span>
          <p className="mt-2 text-2xl font-bold text-neutral-0">
            {numberFormatter.format(card.value)}
          </p>
        </article>
      ))}
    </div>
  );
}

function MonthlyTrend({ analytics }: ExecutiveOverviewProps) {
  const { t } = useTranslation();
  if (!analytics.monthlyTrend.length) {
    return (
      <p className="text-sm text-neutral-2">
        {t("analytics.monthly.noDeposits", "No deposits recorded in the past six months.")}
      </p>
    );
  }

  const max = Math.max(...analytics.monthlyTrend.map((entry) => entry.total), 1);

  return (
    <div className="space-y-3">
      {analytics.monthlyTrend.map((entry) => (
        <div key={entry.monthKey} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-neutral-2">
            <span>{entry.label}</span>
            <span>{currency.format(entry.total)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-300/80 to-sky-300/80"
              style={{ width: `${Math.max(6, Math.round((entry.total / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SaccoLeaders({ analytics }: ExecutiveOverviewProps) {
  const { t } = useTranslation();
  if (!analytics.saccoLeaders.length) {
    return (
      <p className="text-sm text-neutral-2">
        {t("analytics.sacco.noData", "No SACCO contribution data yet.")}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-sm text-neutral-0">
        <thead className="bg-white/5 text-left uppercase tracking-[0.25em] text-[11px] text-neutral-2">
          <tr>
            <th className="px-4 py-3">{t("table.sacco", "SACCO")}</th>
            <th className="px-4 py-3 text-right">{t("table.deposits", "Deposits")}</th>
            <th className="px-4 py-3 text-right">{t("table.unallocated", "Unallocated")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 bg-white/5 text-xs">
          {analytics.saccoLeaders.map((leader) => (
            <tr key={leader.saccoId ?? "all"}>
              <td className="px-4 py-3 font-medium text-neutral-0">{leader.saccoName}</td>
              <td className="px-4 py-3 text-right">{currency.format(leader.total)}</td>
              <td className="px-4 py-3 text-right text-amber-200">
                {currency.format(leader.unallocated)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskSignals({ analytics }: ExecutiveOverviewProps) {
  const { t } = useTranslation();
  if (!analytics.riskSignals.length) {
    return (
      <p className="text-sm text-neutral-2">
        {t("analytics.risk.none", "All ikimina have contributed in the last month.")}
      </p>
    );
  }

  if (analytics.riskSignals.length > 6) {
    return <RiskSignalsVirtualized signals={analytics.riskSignals} />;
  }

  return (
    <div className="space-y-3">
      {analytics.riskSignals.map((signal) => (
        <Link
          key={signal.ikiminaId}
          href={`/ikimina/${signal.ikiminaId}`}
          className="block rounded-2xl border border-white/10 bg-white/5 p-4 text-xs shadow-inner backdrop-blur transition hover:border-white/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-neutral-0">{signal.name}</p>
              {signal.saccoName && <p className="text-[11px] text-neutral-2">{signal.saccoName}</p>}
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]",
                riskTone[signal.risk]
              )}
            >
              {signal.risk === "HIGH"
                ? t("analytics.risk.high", "High risk")
                : signal.risk === "MEDIUM"
                  ? t("analytics.risk.medium", "Medium risk")
                  : t("analytics.risk.low", "Low risk")}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-2">
            {t("analytics.risk.lastContributionPrefix", "Last contribution")} {signal.daysSince}{" "}
            {t("common.daysAgoSuffix", "days ago")}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function ExecutiveOverview({ analytics }: ExecutiveOverviewProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <header>
          <span className="text-lg font-semibold text-neutral-0">
            {t("analytics.sections.forecast", "Forecast")}
          </span>
        </header>
        <article className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-glass">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("analytics.forecast.next", "Next month (estimate)")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-0">
            {currency.format(analytics.forecastNext)}
          </p>
        </article>
      </section>
      <section className="space-y-4">
        <header>
          <span className="text-lg font-semibold text-neutral-0">
            {t("analytics.sections.automation", "Automation summary")}
          </span>
        </header>
        <AutomationSummary analytics={analytics} />
      </section>

      <section className="space-y-4">
        <header>
          <span className="text-lg font-semibold text-neutral-0">
            {t("analytics.sections.momentum", "Deposit momentum")}
          </span>
        </header>
        <MonthlyTrend analytics={analytics} />
      </section>

      <section className="space-y-4">
        <header>
          <span className="text-lg font-semibold text-neutral-0">
            {t("analytics.sections.saccoLeaders", "SACCO leaders")}
          </span>
        </header>
        <SaccoLeaders analytics={analytics} />
      </section>

      <section className="space-y-4">
        <header>
          <span className="text-lg font-semibold text-neutral-0">
            {t("analytics.sections.risk", "Risk signals")}
          </span>
        </header>
        <RiskSignals analytics={analytics} />
      </section>
    </div>
  );
}
