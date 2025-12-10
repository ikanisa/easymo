import type { ReactNode } from "react";
import { Compass, WifiOff } from "lucide-react";

import { cn } from "../utils/cn";

type EmptyStateTone = "default" | "offline" | "quiet";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
  action?: ReactNode;
  tone?: EmptyStateTone;
  offlineHint?: ReactNode;
}

const TONE_STYLES: Record<EmptyStateTone, string> = {
  default:
    "border-white/15 bg-[color-mix(in_srgb,rgba(255,255,255,0.08)_75%,rgba(17,24,39,0.92)_25%)] text-neutral-2",
  offline: "border-amber-500/40 bg-amber-500/10 text-amber-50",
  quiet: "border-dashed border-white/10 bg-transparent text-neutral-2",
};

export function EmptyState({
  title,
  description,
  icon,
  className,
  action,
  tone = "default",
  offlineHint,
}: EmptyStateProps) {
  const resolvedIcon =
    icon ??
    (tone === "offline" ? (
      <WifiOff className="h-6 w-6" aria-hidden />
    ) : (
      <Compass className="h-6 w-6" aria-hidden />
    ));

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-xl)_*_1.1)] border p-8 text-center text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.05)]",
        TONE_STYLES[tone],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-neutral-0 shadow-glass",
          tone === "offline" && "border-amber-500/50 bg-amber-500/20 text-amber-100",
          tone === "quiet" && "border-white/10 bg-transparent text-neutral-2"
        )}
      >
        {resolvedIcon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-neutral-0">{title}</h3>
        {description ? <p className="mt-1 text-xs text-neutral-3">{description}</p> : null}
        {tone === "offline" && offlineHint ? (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-200">
            {offlineHint}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
