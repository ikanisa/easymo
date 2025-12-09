import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KPIStatProps {
  label: ReactNode;
  value: string;
  trend?: ReactNode;
  accent?: "blue" | "yellow" | "green" | "neutral";
}

export function KPIStat({ label, value, trend, accent = "neutral" }: KPIStatProps) {
  const accentColors = {
    blue: "border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300",
    yellow:
      "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-950/50 dark:text-warning-300",
    green:
      "border-success-200 bg-success-50 text-success-700 dark:border-success-800 dark:bg-success-950/50 dark:text-success-300",
    neutral: "border-border bg-surface text-foreground",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        "shadow-sm transition-shadow hover:shadow-md",
        accentColors[accent]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {trend && <div className="mt-1 text-xs opacity-80">{trend}</div>}
    </div>
  );
}
