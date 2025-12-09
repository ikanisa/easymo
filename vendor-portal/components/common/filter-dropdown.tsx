"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  className?: string;
  multiple?: boolean;
}

export function FilterDropdown({
  label,
  options,
  selectedValues,
  onChange,
  className,
  multiple = true,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      onChange(newValues);
    } else {
      onChange([value]);
      setIsOpen(false);
    }
  };

  const selectedCount = selectedValues.length;
  const displayLabel = selectedCount > 0 ? `${label} (${selectedCount})` : label;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors",
          selectedCount > 0
            ? "border-atlas-blue bg-atlas-blue/10 text-atlas-blue-dark dark:bg-atlas-blue/20 dark:text-atlas-blue"
            : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {displayLabel}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />

          {/* Dropdown */}
          <div
            className={cn(
              "absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800",
              "max-h-80 overflow-auto"
            )}
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleToggle(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-atlas-blue/10 text-atlas-blue-dark dark:bg-atlas-blue/20 dark:text-atlas-blue"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="flex items-center gap-2">
                    {option.label}
                    {option.count !== undefined && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        ({option.count})
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
