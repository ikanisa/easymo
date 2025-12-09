"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ExecutiveAnalyticsSnapshot } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/providers/i18n-provider";

const riskTone: Record<ExecutiveAnalyticsSnapshot["riskSignals"][number]["risk"], string> = {
  HIGH: "bg-red-500/20 text-red-200 border border-red-400/60",
  MEDIUM: "bg-amber-500/20 text-amber-100 border border-amber-300/60",
  LOW: "bg-emerald-500/15 text-emerald-100 border border-emerald-300/40",
};

interface RiskSignalsVirtualizedProps {
  signals: ExecutiveAnalyticsSnapshot["riskSignals"];
}

export function RiskSignalsVirtualized({ signals }: RiskSignalsVirtualizedProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation();

  const estimate = useMemo(() => {
    if (!signals.length) return 96;
    return Math.max(88, Math.min(128, Math.round(360 / Math.min(signals.length, 6))));
  }, [signals.length]);

  // TanStack's virtualizer exposes mutable APIs that React Compiler cannot memoize safely.

  const rowVirtualizer = useVirtualizer({
    count: signals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimate,
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="max-h-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-white/5"
    >
      <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {virtualItems.map((virtualRow) => {
          const signal = signals[virtualRow.index];
          return (
            <Link
              key={signal.ikiminaId}
              href={`/ikimina/${signal.ikiminaId}`}
              className="absolute inset-x-0 block border-b border-white/5 p-4 text-xs text-neutral-0 transition hover:border-white/20"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-0">{signal.name}</p>
                  {signal.saccoName && (
                    <p className="text-[11px] text-neutral-2">{signal.saccoName}</p>
                  )}
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
          );
        })}
      </div>
    </div>
  );
}
