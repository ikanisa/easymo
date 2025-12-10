"use client";

import { forwardRef, type InputHTMLAttributes, useId } from "react";

import { cn } from "../utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: "md" | "lg";
}

/**
 * Input Component - Atlas UI Design System
 *
 * WCAG AA compliant with:
 * - Proper label association
 * - Error state with aria-describedby
 * - Minimum 44px tap target
 * - High contrast (7:1 text on white)
 */
const SIZE_CLASSES = {
  md: "px-4 py-2.5 text-base min-h-[44px]",
  lg: "px-5 py-3 text-lg min-h-[48px]",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    leftIcon,
    rightIcon,
    inputSize = "md",
    className,
    id: providedId,
    disabled,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const helperTextId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : helperTextId}
          className={cn(
            // Base styles
            "w-full rounded-lg border transition-all duration-200",
            "text-neutral-900 placeholder:text-neutral-400",
            "dark:text-neutral-100 dark:placeholder:text-neutral-500",
            "bg-white dark:bg-neutral-800",
            "focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue",
            "dark:focus:ring-brand-blue-light dark:focus:border-brand-blue-light",
            "disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed",
            "dark:disabled:bg-neutral-900 dark:disabled:text-neutral-600",
            // Size variants
            SIZE_CLASSES[inputSize],
            // Error state
            error
              ? "border-error-500 focus:ring-error-500 focus:border-error-500"
              : "border-neutral-300 dark:border-neutral-700",
            // Icon padding
            leftIcon ? "pl-10" : "",
            rightIcon ? "pr-10" : "",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <span id={errorId} className="text-sm text-error-600 flex items-center gap-1" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM7.25 5.25C7.25 4.83579 7.58579 4.5 8 4.5C8.41421 4.5 8.75 4.83579 8.75 5.25V8.25C8.75 8.66421 8.41421 9 8 9C7.58579 9 7.25 8.66421 7.25 8.25V5.25ZM8.75 10.75C8.75 11.1642 8.41421 11.5 8 11.5C7.58579 11.5 7.25 11.1642 7.25 10.75C7.25 10.3358 7.58579 10 8 10C8.41421 10 8.75 10.3358 8.75 10.75Z"
              fill="currentColor"
            />
          </svg>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={helperTextId} className="text-sm text-neutral-600 dark:text-neutral-400">
          {helperText}
        </span>
      )}
    </div>
  );
});
