import type { ReactNode } from "react";

import { cn } from "../utils/cn";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Array<{
    label: ReactNode;
    href?: string;
    onClick?: () => void;
    "aria-label"?: string;
  }>;
  actions?: ReactNode;
  metadata?: ReactNode;
  className?: string;
  subdued?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  metadata,
  className,
  subdued = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 rounded-[calc(var(--radius-xl)_*_1.1)] border border-white/10 bg-white/5 p-6 text-neutral-0 shadow-glass",
        subdued && "border-dashed bg-transparent shadow-none",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.35em] text-neutral-2">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const element = item.href ? (
                <a
                  key={index}
                  href={item.href}
                  onClick={item.onClick}
                  aria-label={item["aria-label"]}
                  className={cn(
                    "rounded-full border border-transparent px-3 py-1 transition-colors",
                    isLast
                      ? "border-white/15 bg-white/10 text-neutral-0"
                      : "border-white/5 text-neutral-2 hover:border-white/20 hover:text-neutral-0"
                  )}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  key={index}
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1",
                    isLast
                      ? "border-white/15 bg-white/10 text-neutral-0"
                      : "border-white/5 text-neutral-2"
                  )}
                >
                  {item.label}
                </span>
              );
              return element;
            })}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-neutral-2">{description}</p>
          ) : null}
          {metadata ? <div className="text-xs text-neutral-3">{metadata}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em]">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
