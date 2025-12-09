"use client";

import type { SelectHTMLAttributes } from "react";

import { cn } from "../utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: string[];
  emptyLabel?: string;
}

export function Select({ label, options, className, emptyLabel = "All", ...props }: SelectProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-neutral-0">
      {label && <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">{label}</span>}
      <select
        {...props}
        className={cn(
          "rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue",
          className
        )}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "" ? emptyLabel : option}
          </option>
        ))}
      </select>
    </label>
  );
}
