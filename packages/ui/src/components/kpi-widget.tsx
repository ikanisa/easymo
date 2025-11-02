"use client";

import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export type TrendDirection = "up" | "down" | "neutral";

export interface KPITrend {
  direction: TrendDirection;
  label: string;
  srOnly?: string;
}

export interface KPIWidgetProps extends HTMLAttributes<HTMLElement> {
  label: string;
  value: string | number;
  secondary?: string | number;
  trend?: KPITrend;
}

const trendTone: Record<TrendDirection, string> = {
  up: "text-[color:rgb(var(--easymo-colors-success-500))]",
  down: "text-[color:rgb(var(--easymo-colors-danger-500))]",
  neutral: "text-[color:rgb(var(--easymo-colors-neutral-500))]",
};

export function KPIWidget({
  className,
  label,
  value,
  secondary,
  trend,
  ...props
}: KPIWidgetProps) {
  return (
    <article
      className={clsx(
        "group rounded-2xl border border-[color:rgba(var(--easymo-colors-neutral-200),0.6)] bg-[color:rgba(var(--easymo-colors-neutral-50),0.85)] p-5 shadow-[0_22px_60px_rgba(15,23,42,0.16)] transition hover:border-[color:rgba(var(--easymo-colors-primary-400),0.45)] hover:shadow-[0_30px_80px_rgba(14,165,233,0.22)]",
        className,
      )}
      aria-label={label}
      {...props}
    >
      <header className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:rgb(var(--easymo-colors-neutral-500))]">
          {label}
        </p>
        {trend ? (
          <span
            className={clsx(
              "inline-flex items-center gap-1 text-xs font-semibold",
              trendTone[trend.direction],
            )}
            aria-live="polite"
          >
            <span aria-hidden="true">
              {trend.direction === "up"
                ? "▲"
                : trend.direction === "down"
                ? "▼"
                : "•"}
            </span>
            {trend.label}
            {trend.srOnly ? <span className="sr-only">{trend.srOnly}</span> : null}
          </span>
        ) : null}
      </header>
      <p className="mt-4 text-3xl font-semibold text-[color:rgb(var(--easymo-colors-neutral-900))]">
        {value}
      </p>
      {secondary ? (
        <p className="mt-2 text-sm text-[color:rgb(var(--easymo-colors-neutral-600))]">{secondary}</p>
      ) : null}
    </article>
  );
}
