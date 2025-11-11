"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-emphasized)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] disabled:pointer-events-none disabled:opacity-60 data-[state=loading]:cursor-progress data-[state=loading]:opacity-70",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:var(--color-accent)] text-[color:var(--color-accent-foreground)] shadow-[var(--shadow-floating)]/20 hover:bg-[color:var(--color-accent)]/92 hover:shadow-[var(--shadow-floating)]/35 active:translate-y-[1px]",
        secondary:
          "border border-[color:var(--color-border)]/65 bg-[color:var(--color-surface)]/90 text-[color:var(--color-foreground)] shadow-[var(--shadow-ambient)]/10 hover:border-[color:var(--color-accent)]/45 hover:bg-[color:var(--color-surface)] active:translate-y-[1px]",
        subtle:
          "bg-[color:var(--color-surface-muted)]/85 text-[color:var(--color-foreground)] shadow-[var(--shadow-ambient)]/5 hover:bg-[color:var(--color-surface-muted)] active:translate-y-[1px]",
        ghost:
          "bg-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]/60 active:bg-[color:var(--color-surface)]/70",
        outline:
          "border border-[color:var(--color-border)] text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent)]/45 hover:bg-[color:var(--color-surface)]/50 active:translate-y-[1px]",
        danger:
          "bg-[color:var(--color-danger)] text-white shadow-[var(--shadow-floating)]/25 hover:bg-[color:var(--color-danger)]/90 focus-visible:ring-[color:var(--color-danger)]/40",
        link:
          "bg-transparent text-[color:var(--color-accent)] underline-offset-4 hover:underline focus-visible:ring-offset-0",
      },
      size: {
        xs: "min-h-[2.25rem] px-3 text-body-sm",
        sm: "min-h-[2.5rem] px-3.5 text-body-sm",
        md: "min-h-[2.75rem] px-4 text-body",
        lg: "min-h-[3rem] px-5 text-body-lg",
        xl: "min-h-[3.25rem] px-6 text-body-lg",
        icon: "min-h-[2.75rem] w-[2.75rem] px-0 [&>svg]:h-5 [&>svg]:w-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

const loaderClasses = "inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  offlineBehavior?: "block" | "allow";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const computedDisabled = disabled ?? loading;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={computedDisabled}
        data-state={loading ? "loading" : undefined}
        aria-busy={loading ? "true" : undefined}
        {...props}
      >
        {loading ? (
          <>
            <span aria-hidden className={loaderClasses} />
            <span className="sr-only">Processing</span>
            <span aria-hidden className="inline-flex items-center gap-2 opacity-80">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
