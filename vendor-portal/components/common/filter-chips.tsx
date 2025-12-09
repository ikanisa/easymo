"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  value: string | number;
  removable?: boolean;
}

interface FilterChipsProps {
  filters: FilterChip[];
  onRemove?: (filterId: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterChips({ filters, onRemove, onClearAll, className }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Filters:</span>
      {filters.map((filter) => (
        <div
          key={filter.id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-atlas-blue/20 bg-atlas-blue/10 px-3 py-1 text-sm font-medium text-atlas-blue-dark",
            "dark:border-atlas-blue/30 dark:bg-atlas-blue/20 dark:text-atlas-blue"
          )}
        >
          <span>{filter.label}</span>
          {filter.removable !== false && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(filter.id)}
              className={cn(
                "rounded-full p-0.5 transition-colors hover:bg-atlas-blue/20",
                "dark:hover:bg-atlas-blue/30"
              )}
              aria-label={`Remove ${filter.label} filter`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            "text-sm font-medium text-neutral-600 underline decoration-dotted underline-offset-4 transition-colors hover:text-neutral-900",
            "dark:text-neutral-400 dark:hover:text-neutral-100"
          )}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
