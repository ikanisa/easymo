import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn’t complete that request. Please try again or contact support.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={clsx(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed",
        "border-[color:var(--ui-color-danger)]/45 bg-[color:var(--ui-color-surface)]/60 px-8 py-10 text-center shadow-[var(--ui-elevation-low,0_1px_2px_rgba(7,11,26,0.2))]",
        "backdrop-blur-xl",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[color:var(--ui-color-foreground)]">{title}</h3>
        {description ? (
          <p className="text-sm text-[color:var(--ui-color-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
