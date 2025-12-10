import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

import { cn } from "../utils/cn";

export interface SuccessStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
  eyebrow?: ReactNode;
}

export function SuccessState({
  title,
  description,
  action,
  className,
  icon,
  eyebrow,
}: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-xl)_*_1.1)] border border-emerald-500/40 bg-emerald-500/10 p-8 text-center text-sm text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/20 text-emerald-100 shadow-glass">
        {icon ?? <CheckCircle2 className="h-6 w-6" aria-hidden />}
      </div>
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-200/90">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-base font-semibold text-emerald-50">{title}</h3>
        {description ? <p className="mt-1 text-xs text-emerald-100/80">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
