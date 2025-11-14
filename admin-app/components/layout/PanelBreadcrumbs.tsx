"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { buildPanelBreadcrumbs } from "@/components/layout/nav-items";
import { toLinkHref } from "@/lib/link-helpers";

interface PanelBreadcrumbsProps {
  className?: string;
}

export function PanelBreadcrumbs({ className }: PanelBreadcrumbsProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(
    () => buildPanelBreadcrumbs(pathname),
    [pathname],
  );

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={classNames(
        "mb-4 text-xs text-[color:var(--color-muted)]",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {breadcrumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {crumb.href && !crumb.current ? (
              <Link
                href={toLinkHref(crumb.href)}
                className="rounded px-1 py-0.5 transition hover:text-[color:var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={crumb.current ? "page" : undefined}
                className={classNames(
                  crumb.current && "font-semibold text-[color:var(--color-foreground)]",
                )}
              >
                {crumb.label}
              </span>
            )}
            {index < breadcrumbs.length - 1 ? (
              <span aria-hidden="true" className="text-[color:var(--color-border)]">
                /
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
