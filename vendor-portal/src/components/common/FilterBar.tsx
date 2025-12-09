"use client";

import { Fragment, useMemo, useRef, type ReactNode } from "react";
import { Popover, Transition } from "@headlessui/react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterTone = "default" | "info" | "success" | "warning" | "danger";

export interface FilterChipDefinition {
  id: string;
  label: string;
  valueLabel?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  tone?: FilterTone;
  renderEditor: (controls: { close: () => void }) => ReactNode;
  onClear?: () => void;
}

interface FilterBarProps {
  filters: FilterChipDefinition[];
  onClearAll?: () => void;
  className?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const toneStyles: Record<FilterTone, string> = {
  default: "border-white/10 bg-white/5 text-neutral-0 hover:border-white/20 hover:bg-white/10",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-100 hover:border-sky-400/70 hover:bg-sky-500/20",
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/60 hover:bg-emerald-500/20",
  warning:
    "border-amber-500/40 bg-amber-500/10 text-amber-100 hover:border-amber-400/70 hover:bg-amber-500/20",
  danger:
    "border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-400/80 hover:bg-red-500/20",
};

export function FilterBar({ filters, onClearAll, className, prefix, suffix }: FilterBarProps) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const orderedIds = useMemo(() => filters.map((filter) => filter.id), [filters]);

  const focusNeighbor = (currentId: string, direction: -1 | 1) => {
    const currentIndex = orderedIds.indexOf(currentId);
    if (currentIndex === -1) return;
    const total = orderedIds.length;
    const nextIndex = (currentIndex + direction + total) % total;
    const nextId = orderedIds[nextIndex];
    const nextRef = buttonRefs.current[nextId];
    nextRef?.focus();
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-0",
        className
      )}
    >
      {prefix}
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Table filters">
        {filters.map((filter, _index) => {
          const tone = filter.tone ?? "default";
          return (
            <Popover key={filter.id} className="relative">
              {({ close }) => (
                <>
                  <Popover.Button
                    ref={(node) => {
                      buttonRefs.current[filter.id] = node;
                    }}
                    disabled={filter.disabled}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight") {
                        event.preventDefault();
                        focusNeighbor(filter.id, 1);
                      }
                      if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        focusNeighbor(filter.id, -1);
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                      toneStyles[tone],
                      filter.active
                        ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0b1020]"
                        : ""
                    )}
                  >
                    <span className="font-medium">{filter.label}</span>
                    {filter.valueLabel && (
                      <span className="truncate text-neutral-2">{filter.valueLabel}</span>
                    )}
                    {filter.badge && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-neutral-2">
                        {filter.badge}
                      </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Popover.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Popover.Panel className="absolute left-0 z-30 mt-2 min-w-[220px] max-w-[320px] rounded-2xl border border-white/10 bg-[#0b1020] p-4 text-sm shadow-2xl focus:outline-none">
                      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neutral-2">
                        <span>{filter.label}</span>
                        {filter.onClear && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-neutral-2 transition hover:border-white/20 hover:text-neutral-0"
                            onClick={() => filter.onClear?.()}
                          >
                            <X className="h-3 w-3" />
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-3 text-sm text-neutral-0">
                        {filter.renderEditor({
                          close: () => {
                            close();
                            buttonRefs.current[filter.id]?.focus();
                          },
                        })}
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
          );
        })}
      </div>
      {suffix}
      {onClearAll && filters.some((filter) => filter.active) && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.3em] text-neutral-2 transition hover:border-white/20 hover:text-neutral-0"
        >
          <X className="h-3.5 w-3.5" /> Clear all
        </button>
      )}
    </div>
  );
}
