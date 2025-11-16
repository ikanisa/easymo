import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  illustration?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, illustration, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed",
        "border-[color:var(--ui-color-border)]/70 bg-[color:var(--ui-color-surface)]/55 px-8 py-10 text-center shadow-[var(--ui-elevation-low,0_1px_2px_rgba(7,11,26,0.2))]",
        "backdrop-blur-xl",
        className,
      )}
    >
      {illustration}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[color:var(--ui-color-foreground)]">{title}</h3>
        <p className="text-sm text-[color:var(--ui-color-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}
