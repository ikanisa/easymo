"use client";

import type { ReactNode } from "react";

import { cn } from "../utils/cn";

export interface StickyActionBarProps {
  children: ReactNode;
  label: string;
  className?: string;
}

export function StickyActionBar({ children, label, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center md:hidden",
        className
      )}
    >
      <div
        className="pointer-events-auto flex w-[min(440px,92%)] items-center justify-between gap-3 rounded-3xl border border-white/10 bg-ink/90 px-4 py-3 text-xs text-neutral-0 shadow-glass backdrop-blur"
        role="region"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
