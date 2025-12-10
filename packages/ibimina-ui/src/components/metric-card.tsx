import type { ReactNode } from "react";
import { gradients } from "../theme";
import { cn } from "../utils/cn";

export interface MetricCardProps {
  label: ReactNode;
  value: string | number;
  trend?: ReactNode;
  accent?: "blue" | "yellow" | "green" | "neutral";
  className?: string;
}

const accentMap: Record<
  NonNullable<MetricCardProps["accent"]>,
  { border: string; bg: string; text: string; trend: string }
> = {
  blue: {
    border: "border-sky-400/30 dark:border-sky-300/30",
    bg: gradients.skyGlass,
    text: "text-sky-900 dark:text-sky-100",
    trend: "text-sky-700 dark:text-sky-200",
  },
  yellow: {
    border: "border-amber-200/60 dark:border-amber-100/30",
    bg: gradients.sandMist,
    text: "text-amber-800 dark:text-amber-100",
    trend: "text-amber-700 dark:text-amber-200",
  },
  green: {
    border: "border-emerald-200/60 dark:border-emerald-200/40",
    bg: gradients.forestHaze,
    text: "text-emerald-800 dark:text-emerald-100",
    trend: "text-emerald-700 dark:text-emerald-200",
  },
  neutral: {
    border: "border-neutral-200/80 dark:border-neutral-700",
    bg: gradients.slateSheen,
    text: "text-neutral-700 dark:text-neutral-200",
    trend: "text-neutral-600 dark:text-neutral-300",
  },
};

export function MetricCard({
  label,
  value,
  trend,
  accent = "neutral",
  className,
}: MetricCardProps) {
  const theme = accentMap[accent];
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/80 p-5 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md transition-all duration-interactive hover:-translate-y-1 hover:shadow-lg dark:bg-neutral-900/70",
        theme.border,
        className
      )}
    >
      <div className="absolute inset-0" style={{ backgroundImage: theme.bg }} aria-hidden />
      <div className="relative space-y-2">
        <p className={cn("text-xs font-medium uppercase tracking-[0.15em]", theme.text)}>{label}</p>
        <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-0">{value}</p>
        {trend && <div className={cn("text-sm font-medium", theme.trend)}>{trend}</div>}
      </div>
    </article>
  );
}
