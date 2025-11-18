"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { ChevronRight, Home } from "lucide-react";
import { buildPanelBreadcrumbs } from "../layout/nav-items";
import { toLinkHref } from "@/lib/link-helpers";

interface EnhancedBreadcrumbsProps {
  className?: string;
  currentLabel?: string;
  showHome?: boolean;
}

/**
 * EnhancedBreadcrumbs: Accessible breadcrumb navigation
 * 
 * Features:
 * - ARIA labels for screen readers
 * - Keyboard navigation support
 * - Visual indicators for current page
 * - Optional home icon
 * - Responsive text truncation
 */
export function EnhancedBreadcrumbs({ 
  className, 
  currentLabel,
  showHome = true 
}: EnhancedBreadcrumbsProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(
    () => buildPanelBreadcrumbs(pathname, currentLabel),
    [pathname, currentLabel],
  );

  if (breadcrumbs.length <= 1 && !showHome) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={classNames(
        "flex items-center gap-2 text-sm text-gray-600",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-2" role="list">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isFirst = index === 0;

          return (
            <li
              key={`${crumb.label}-${index}`}
              className="flex items-center gap-2"
              aria-current={crumb.current ? "page" : undefined}
            >
              {crumb.href && (!crumb.current || (isFirst && showHome)) ? (
                <Link
                  href={toLinkHref(crumb.href)}
                  className={classNames(
                    "flex items-center gap-2 rounded px-2 py-1 transition-all",
                    "hover:text-gray-900 hover:bg-gray-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                  )}
                  title={`Navigate to ${crumb.label}`}
                  aria-label={crumb.current ? `Current page: ${crumb.label}` : undefined}
                >
                  {isFirst && showHome && (
                    <Home className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[200px]">{crumb.label}</span>
                </Link>
              ) : (
                <span
                  className={classNames(
                    "flex items-center gap-2 px-2 py-1",
                    crumb.current && "font-semibold text-gray-900",
                  )}
                  aria-label={crumb.current ? `Current page: ${crumb.label}` : crumb.label}
                >
                  {isFirst && showHome && (
                    <Home className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[200px]">{crumb.label}</span>
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
