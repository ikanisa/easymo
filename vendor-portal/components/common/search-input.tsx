"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  onSearch?: (value: string) => void;
  autoFocus?: boolean;
}

export function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  className,
  onSearch,
  autoFocus = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue || "");
  const debouncedValue = useDebouncedValue(internalValue, debounceMs);

  // Update internal value when controlled value changes
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  // Call onSearch when debounced value changes
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedValue);
    }
  }, [debouncedValue, onSearch]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setInternalValue("");
    onChange?.("");
    onSearch?.("");
  }, [onChange, onSearch]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "h-10 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-10 text-sm transition-colors",
          "placeholder:text-neutral-500",
          "focus:border-atlas-blue focus:outline-none focus:ring-2 focus:ring-atlas-blue/20",
          "dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        aria-label={placeholder}
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors",
            "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700",
            "dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          )}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
