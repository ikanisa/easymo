"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string | null;
  icon?: ReactNode;
};

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-xs text-neutral-500", className)}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-11 transition hover:bg-neutral-3 hover:text-neutral-12"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-12">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
              {!isLast && <ChevronRight className="h-3 w-3 text-neutral-7" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
