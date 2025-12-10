import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "../utils/cn";

export interface ErrorStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
  offlineHint?: ReactNode;
}

export function ErrorState({
  title,
  description,
  action,
  className,
  icon,
  offlineHint,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-xl)_*_1.1)] border border-red-500/40 bg-red-500/10 p-8 text-center text-sm text-red-100 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/50 bg-red-500/20 text-red-100 shadow-glass">
        {icon ?? <AlertTriangle className="h-6 w-6" aria-hidden />}
      </div>
      <div>
        <h3 className="text-base font-semibold text-red-50">{title}</h3>
        {description ? <p className="mt-1 text-xs text-red-100/80">{description}</p> : null}
        {offlineHint ? (
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.35em] text-amber-200/80">
            {offlineHint}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
