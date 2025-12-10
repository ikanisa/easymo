"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

/**
 * WCAG AA Compliant Button Component
 *
 * All variants meet 4.5:1 contrast minimum.
 * Includes proper focus indicators, loading states, and accessibility.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 focus-visible:ring-neutral-900 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:active:bg-neutral-300 dark:focus-visible:ring-neutral-100",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 focus-visible:ring-neutral-500 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 dark:focus-visible:ring-neutral-400",
  outline:
    "border-2 border-neutral-300 text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:focus-visible:ring-neutral-400",
  ghost:
    "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-500 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:focus-visible:ring-neutral-400",
  danger:
    "bg-error-600 text-white hover:bg-error-700 active:bg-error-800 focus-visible:ring-error-600 disabled:opacity-50 dark:bg-error-500 dark:hover:bg-error-600 dark:active:bg-error-700 dark:focus-visible:ring-error-500",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg gap-1.5 min-h-[40px]", // 40px minimum tap target
  md: "px-4 py-2.5 text-base rounded-lg gap-2 min-h-[44px]", // 44px standard tap target
  lg: "px-6 py-3.5 text-lg rounded-xl gap-2.5 min-h-[48px]", // 48px large tap target
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        // Variant styles
        VARIANT_CLASSES[variant],
        // Size styles
        SIZE_CLASSES[size],
        // Full width
        fullWidth ? "w-full" : undefined,
        // Custom className
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin"
            width={size === "sm" ? 14 : size === "lg" ? 20 : 16}
            height={size === "sm" ? 14 : size === "lg" ? 20 : 16}
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});
