"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const buttonStyles = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 ring-offset-[color:var(--ui-color-surface)]",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:var(--ui-color-accent)] text-[color:var(--ui-color-accent-foreground)] shadow-[var(--ui-glass-shadow)] hover:bg-[color:var(--ui-color-accent)]/90",
        default:
          "bg-[color:var(--ui-color-accent)] text-[color:var(--ui-color-accent-foreground)] shadow-[var(--ui-glass-shadow)] hover:bg-[color:var(--ui-color-accent)]/90",
        outline:
          "border-[color:var(--ui-color-border)] bg-[color:var(--ui-color-surface)] text-[color:var(--ui-color-foreground)] hover:border-[color:var(--ui-color-accent)]/60 hover:bg-[color:var(--ui-color-surface-elevated)]",
        ghost:
          "bg-transparent text-[color:var(--ui-color-foreground)] hover:bg-[color:var(--ui-color-surface-muted)]/60",
        subtle:
          "bg-[color:var(--ui-color-surface-muted)]/70 text-[color:var(--ui-color-foreground)] hover:bg-[color:var(--ui-color-surface-muted)]",
        danger:
          "bg-[color:var(--ui-color-danger)] text-white hover:bg-[color:var(--ui-color-danger)]/90",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
      loading: {
        true: "cursor-progress",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    asChild?: boolean;
    loading?: boolean;
    offlineBehavior?: "allow" | "block";
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild = false, variant, size, className, loading = false, disabled, children, offlineBehavior: _offlineBehavior, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = disabled ?? loading;
  const ariaBusy = loading || Boolean((props as ButtonHTMLAttributes<HTMLButtonElement>)["aria-busy"]);
  return (
    <Comp
      ref={ref}
      className={clsx(buttonStyles({ variant, size, loading }), className)}
      disabled={isDisabled}
      data-loading={loading ? "true" : undefined}
      aria-busy={ariaBusy ? true : undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--ui-color-accent-foreground)]/50 border-t-transparent"
        />
      )}
      <span className="inline-flex items-center gap-2 leading-none">{children}</span>
    </Comp>
  );
});

Button.displayName = "Button";
