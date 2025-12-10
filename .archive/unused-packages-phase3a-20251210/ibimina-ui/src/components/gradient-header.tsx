import type { ReactNode } from "react";

import { cn } from "../utils/cn";
import { gradients } from "../theme";

export interface GradientHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function GradientHeader({
  title,
  subtitle,
  badge,
  className,
  children,
}: GradientHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/40 bg-white/70 p-6 text-neutral-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-neutral-700/60 dark:bg-neutral-900/60 dark:text-neutral-0",
        className
      )}
      style={{ backgroundImage: gradients.skyGlass }}
    >
      <div className="relative z-10 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.015em]">{title}</h1>
            {subtitle && (
              <div className="text-sm text-neutral-800/80 dark:text-neutral-100/80">{subtitle}</div>
            )}
          </div>
          {badge}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/10 to-white/0 dark:from-neutral-900/70 dark:via-neutral-900/30 dark:to-transparent"
        aria-hidden
      />
    </div>
  );
}
