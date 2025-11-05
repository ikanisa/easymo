"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  hint?: string;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, startAdornment, endAdornment, hint, invalid = false, disabled, id, ...props },
  ref,
) {
  const describedBy = hint ? `${id ?? props.name ?? "input"}-hint` : undefined;
  return (
    <div className={clsx("flex flex-col gap-1 text-[color:var(--ui-color-foreground)]", disabled && "opacity-70")}> 
      <div
        className={clsx(
          "flex w-full items-center gap-2 rounded-xl border bg-[color:var(--ui-color-surface)]/90 px-3 py-2 text-sm shadow-sm transition",
          invalid
            ? "border-[color:var(--ui-color-danger)] focus-within:border-[color:var(--ui-color-danger)]"
            : "border-[color:var(--ui-color-border)] focus-within:border-[color:var(--ui-color-accent)]/50",
          "focus-within:shadow-[0_0_0_3px_rgba(56,189,248,0.18)]",
          disabled && "pointer-events-none bg-[color:var(--ui-color-surface-muted)]/60",
          className,
        )}
      >
        {startAdornment && <span className="text-xs text-[color:var(--ui-color-muted)]">{startAdornment}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={clsx(
            "flex-1 bg-transparent text-sm text-[color:var(--ui-color-foreground)] placeholder:text-[color:var(--ui-color-muted)] focus-visible:outline-none",
          )}
          {...props}
        />
        {endAdornment && <span className="text-xs text-[color:var(--ui-color-muted)]">{endAdornment}</span>}
      </div>
      {hint && (
        <p id={describedBy} className="text-xs text-[color:var(--ui-color-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = "Input";
