import type { ReactNode } from "react";

import { gradients } from "../theme";
import { cn } from "../utils/cn";

export interface GlassCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function GlassCard({ title, subtitle, actions, className, children }: GlassCardProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/70 p-6 text-neutral-900 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md transition-all duration-smooth hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-700/70 dark:bg-neutral-900/70 dark:text-neutral-50",
        className
      )}
      style={{ backgroundImage: gradients.slateSheen }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/30 dark:from-neutral-900/70 dark:via-neutral-900/30 dark:to-neutral-900/10"
        aria-hidden
      />
      {(title || actions) && (
        <header className="relative mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-0">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-neutral-700 dark:text-neutral-200">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="relative space-y-4">{children}</div>
    </section>
  );
}
