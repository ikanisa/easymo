/**
 * Aurora Breadcrumbs Component
 * Navigation trail with separators
 */

'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  separator?: React.ReactNode;
  className?: string;
}

export function Breadcrumbs({ 
  items, 
  showHome = true, 
  separator = <ChevronRight className="w-4 h-4" />,
  className 
}: BreadcrumbsProps) {
  const allItems = showHome 
    ? [{ label: 'Home', href: '/', icon: <Home className="w-4 h-4" /> }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-2', className)}>
      <ol className="flex items-center gap-2">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-medium',
                    'text-[var(--aurora-text-muted)] hover:text-[var(--aurora-accent)]',
                    'transition-colors duration-150'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-medium',
                    isLast 
                      ? 'text-[var(--aurora-text-primary)]' 
                      : 'text-[var(--aurora-text-muted)]'
                  )}
                >
                  {item.icon}
                  {item.label}
                </span>
              )}

              {!isLast && (
                <span className="text-[var(--aurora-text-muted)]">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
