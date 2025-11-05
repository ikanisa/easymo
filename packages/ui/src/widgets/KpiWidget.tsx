"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface KpiWidgetProps {
  label: string;
  value: ReactNode;
  changeLabel?: string;
  trend?: "up" | "down" | "flat";
  icon?: ReactNode;
  context?: string;
}

const TREND_LABEL: Record<NonNullable<KpiWidgetProps["trend"]>, string> = {
  up: "Trending up",
  down: "Trending down",
  flat: "Stable",
};

export function KpiWidget({ label, value, changeLabel, trend = "flat", icon, context }: KpiWidgetProps) {
  return (
    <article
      className={clsx(
        "flex flex-col gap-3 rounded-3xl border border-[color:var(--ui-color-border)]/40",
        "bg-[color:var(--ui-color-surface)]/85 p-5 shadow-[var(--ui-glass-shadow)]",
      )}
      aria-label={`${label} metric`}
    >
      <header className="flex items-center justify-between text-sm text-[color:var(--ui-color-muted)]">
        <span className="font-medium tracking-[0.08em] uppercase">{label}</span>
        {icon && <span aria-hidden className="text-[color:var(--ui-color-accent)]">{icon}</span>}
      </header>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-3xl font-semibold tracking-tight text-[color:var(--ui-color-foreground)]">{value}</span>
        {changeLabel && (
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
              trend === "up" && "bg-emerald-500/15 text-emerald-300",
              trend === "down" && "bg-rose-500/15 text-rose-200",
              trend === "flat" && "bg-[color:var(--ui-color-surface-muted)]/60 text-[color:var(--ui-color-foreground)]",
            )}
            role="status"
            aria-live="polite"
            aria-label={TREND_LABEL[trend]}
          >
            {changeLabel}
          </span>
        )}
      </div>
      {context && (
        <p className="text-sm text-[color:var(--ui-color-muted)]">{context}</p>
      )}
    </article>
  );
}
