'use client';

/**
 * FilterChip - Filter chip component for date/category filters
 */

import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function FilterChip({
  label,
  isActive = false,
  onClick,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'vp-filter-chip',
        isActive && 'vp-filter-chip--active',
        className
      )}
      onClick={onClick}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

interface FilterChipsProps {
  options: { id: string; label: string }[];
  activeId: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function FilterChips({
  options,
  activeId,
  onChange,
  className,
}: FilterChipsProps) {
  return (
    <div className={cn('vp-filters', className)}>
      {options.map((option) => (
        <FilterChip
          key={option.id}
          label={option.label}
          isActive={option.id === activeId}
          onClick={() => onChange?.(option.id)}
        />
      ))}
    </div>
  );
}
