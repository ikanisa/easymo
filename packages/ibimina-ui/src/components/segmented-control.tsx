"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import { cn } from "../utils/cn";

type SegmentedValue = string | number;

export interface SegmentedOption {
  value: SegmentedValue;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}

interface SegmentedControlProps
  extends Pick<HTMLAttributes<HTMLDivElement>, "aria-label" | "aria-labelledby"> {
  name?: string;
  value: SegmentedValue;
  onValueChange: (value: SegmentedValue) => void;
  options: SegmentedOption[];
  className?: string;
  columns?: 1 | 2 | 3;
}

export function SegmentedControl({
  name,
  value,
  onValueChange,
  options,
  className,
  columns = 1,
  ...aria
}: SegmentedControlProps) {
  const fallbackName = useId();
  const fieldName = name ?? fallbackName;

  return (
    <div
      role="radiogroup"
      className={cn(
        "grid gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        className
      )}
      {...aria}
    >
      {options.map((option) => {
        const id = `${fieldName}-${String(option.value)}`;
        const selected = option.value === value;
        return (
          <label
            key={id}
            htmlFor={id}
            className={cn(
              "interactive-scale flex cursor-pointer flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition",
              selected
                ? "border-white/50 bg-white/15 text-neutral-0"
                : "border-white/15 bg-white/5 text-neutral-2 hover:border-white/25 hover:bg-white/10",
              option.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <input
              id={id}
              type="radio"
              className="sr-only"
              name={fieldName}
              value={String(option.value)}
              checked={selected}
              onChange={() => onValueChange(option.value)}
              disabled={option.disabled}
            />
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
              {option.icon && <span aria-hidden>{option.icon}</span>}
              <span className="text-neutral-1">{option.label}</span>
            </span>
            {option.description ? (
              <span className="text-[11px] text-neutral-2">{option.description}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
