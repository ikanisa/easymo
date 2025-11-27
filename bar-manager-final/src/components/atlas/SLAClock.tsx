"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

export interface SLAClockProps {
  /**
   * Target time for the SLA deadline. Can be a Date instance or value supported by the Date constructor.
   */
  target: Date | string | number;
  /** Optional label displayed above the clock. */
  label?: string;
  /**
   * Number of minutes that make up the full SLA window. Used to calculate the fill percentage of the clock.
   */
  windowMinutes?: number;
  /** Optional helper text rendered below the timer. */
  helperText?: string;
  className?: string;
}

function formatDuration(ms: number) {
  if (ms <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function SLAClock({
  target,
  label = "SLA Countdown",
  windowMinutes = 15,
  helperText,
  className,
}: SLAClockProps) {
  const targetMs = useMemo(() => new Date(target).getTime(), [target]);
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, targetMs - Date.now()));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [targetMs]);

  const durationLabel = formatDuration(remaining);
  const windowMs = windowMinutes * 60 * 1000;
  const percentage = Math.max(0, Math.min(100, Math.round((remaining / windowMs) * 100)));

  const statusTone = remaining === 0 ? "text-red-600" : percentage < 33 ? "text-amber-600" : "text-emerald-600";

  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        "dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
      aria-live="polite"
      aria-label={`${label} ${durationLabel}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className={clsx("mt-2 text-4xl font-semibold tabular-nums", statusTone)}>{durationLabel}</p>
          {helperText ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
          ) : null}
        </div>
        <div className="relative h-16 w-16" role="img" aria-hidden>
          <svg viewBox="0 0 36 36" className="h-full w-full">
            <path
              className="fill-none stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="4"
              strokeLinecap="round"
              d="M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"
            />
            <path
              className={clsx(
                "fill-none",
                remaining === 0 ? "stroke-red-500" : percentage < 33 ? "stroke-amber-500" : "stroke-emerald-500",
              )}
              strokeLinecap="round"
              strokeWidth={4}
              strokeDasharray={`${percentage}, 100`}
              d="M18 2a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300">
            {percentage}%
          </span>
        </div>
      </div>
    </section>
  );
}

