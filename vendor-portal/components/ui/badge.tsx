"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Typography } from "./Typography";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "critical" | "pending";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  dot?: boolean;
}

const VARIANT_CLASS_MAP: Record<BadgeVariant, string> = {
  neutral:
    "bg-[var(--color-surface-subtle)] text-[var(--color-foreground)] border border-[var(--color-border-subtle)]",
  info: "bg-[var(--color-info-50)] text-[var(--color-info-700)] border border-[var(--color-info-200)]",
  success:
    "bg-[var(--color-success-50)] text-[var(--color-success-700)] border border-[var(--color-success-200)]",
  warning:
    "bg-[var(--color-warning-50)] text-[var(--color-warning-700)] border border-[var(--color-warning-200)]",
  critical:
    "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] border border-[var(--color-danger-200)]",
  pending:
    "bg-[var(--color-warning-100)] text-[var(--color-warning-800)] border border-[var(--color-warning-300)]",
};

const SIZE_CLASS_MAP: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
  lg: "px-3 py-1.5 text-base gap-2",
};

const DOT_CLASS_MAP: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--color-foreground-muted)]",
  info: "bg-[var(--color-info-500)]",
  success: "bg-[var(--color-success-500)]",
  warning: "bg-[var(--color-warning-500)]",
  critical: "bg-[var(--color-danger-500)]",
  pending: "bg-[var(--color-warning-500)] animate-pulse",
};

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-full font-medium tracking-tight",
        "transition-[background-color,color,border-color] duration-150 ease-[var(--motion-ease-standard)]",
        VARIANT_CLASS_MAP[variant],
        SIZE_CLASS_MAP[size],
        className
      )}
    >
      {dot ? (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASS_MAP[variant])}
          aria-hidden="true"
        />
      ) : null}
      <Typography as="span" variant={size === "lg" ? "body" : "body-sm"} inline>
        {children}
      </Typography>
    </span>
  );
}
