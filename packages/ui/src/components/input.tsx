"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /**
   * Visually emphasise validation errors.
   */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid ? "true" : undefined}
        disabled={disabled}
        className={clsx(
          "block w-full rounded-lg border border-[color:rgba(var(--easymo-colors-neutral-400),0.45)] bg-white/80 px-3 py-2 text-sm text-[color:rgb(var(--easymo-colors-neutral-900))] shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--easymo-colors-primary-400)] disabled:cursor-not-allowed disabled:opacity-60",
          invalid &&
            "border-[color:rgba(var(--easymo-colors-danger-500),0.65)] focus-visible:outline-[color:var(--easymo-colors-danger-400)]",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
