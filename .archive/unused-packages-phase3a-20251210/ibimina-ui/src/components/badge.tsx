import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface BadgeProps {
  children: ReactNode;
  variant?: "neutral" | "info" | "success" | "warning" | "critical" | "pending";
  size?: "sm" | "md" | "lg";
  className?: string;
  dot?: boolean;
}

/**
 * Badge Component - Atlas UI Design System
 *
 * WCAG AA compliant with proper contrast ratios.
 * Used for status indicators, tags, and labels.
 */
const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
  info: "bg-info-50 text-info-700 border-info-200 dark:bg-info-900 dark:text-info-300 dark:border-info-700",
  success: "bg-success-50 text-success-700 border-success-200 dark:bg-success-900 dark:text-success-300 dark:border-success-700",
  warning: "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900 dark:text-warning-300 dark:border-warning-700",
  critical: "bg-error-50 text-error-700 border-error-200 dark:bg-error-900 dark:text-error-300 dark:border-error-700",
  pending: "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900 dark:text-warning-300 dark:border-warning-700",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
  lg: "px-3 py-1.5 text-base gap-2",
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
        "inline-flex items-center rounded-full border font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            variant === "success" && "bg-success-600",
            variant === "warning" && "bg-warning-600",
            variant === "critical" && "bg-error-600",
            variant === "info" && "bg-info-600",
            variant === "pending" && "bg-warning-600 animate-pulse",
            variant === "neutral" && "bg-neutral-600"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
