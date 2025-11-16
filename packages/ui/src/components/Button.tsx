import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import {
  cva,
  type VariantProps,
} from "class-variance-authority";
import {
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";

const buttonVariants = cva(
  clsx(
    "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
    "focus-visible:outline-none focus-visible:ring-[length:var(--ui-focus-ring-width,2px)] focus-visible:ring-offset-[length:var(--ui-focus-ring-offset,2px)]",
    "focus-visible:ring-[color:var(--ui-focus-ring-color,var(--ui-color-outline))] focus-visible:ring-offset-[color:var(--ui-color-surface)]",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ),
  {
    variants: {
      variant: {
        primary: clsx(
          "bg-[color:var(--ui-color-accent)]",
          "text-[color:var(--ui-color-accent-foreground)]",
          "shadow-[var(--ui-elevation-low,0_1px_2px_rgba(7,11,26,0.2))]",
          "hover:bg-[color:var(--ui-color-accent)]/90",
        ),
        outline: clsx(
          "border border-[color:var(--ui-color-border)]",
          "bg-[color:var(--ui-color-surface)]/85",
          "text-[color:var(--ui-color-foreground)]",
          "hover:border-[color:var(--ui-color-accent)]/60",
          "hover:bg-[color:var(--ui-color-surface)]",
        ),
        ghost: clsx(
          "bg-transparent",
          "text-[color:var(--ui-color-foreground)]",
          "hover:bg-[color:var(--ui-color-surface-muted)]/75",
        ),
        subtle: clsx(
          "bg-[color:var(--ui-color-surface-muted)]/80",
          "text-[color:var(--ui-color-foreground)]",
          "hover:bg-[color:var(--ui-color-surface-muted)]/95",
        ),
        danger: clsx(
          "bg-[color:var(--ui-color-danger)]",
          "text-[color:var(--ui-color-foreground)]",
          "hover:bg-[color:var(--ui-color-danger)]/85",
        ),
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

const loaderClasses = clsx(
  "inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render the button as a different component (e.g. Link).
   */
  asChild?: boolean;
  /**
   * Show a loading indicator and disable interactions.
   */
  loading?: boolean;
  /**
   * Preserved for compatibility with consumers that toggle offline UX.
   * The UI package does not implement network awareness, but passing the prop
   * prevents TypeScript errors in downstream apps.
   */
  offlineBehavior?: "block" | "allow";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function UIButton(
  {
    asChild = false,
    className,
    disabled,
    loading = false,
    variant,
    size,
    children,
    offlineBehavior: _offlineBehavior,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const computedDisabled = disabled ?? loading;

  return (
    <Comp
      ref={ref}
      className={clsx(buttonVariants({ variant, size }), className)}
      disabled={computedDisabled}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading ? "true" : undefined}
      {...props}
    >
      {loading ? (
        <>
          <span aria-hidden className={loaderClasses} />
          <span className="sr-only">Processing</span>
          <span aria-hidden className="inline-flex items-center gap-2 opacity-80">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

export { buttonVariants };
