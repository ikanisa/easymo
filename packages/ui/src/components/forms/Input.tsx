import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";

const inputVariants = cva(
  clsx(
    "block w-full rounded-xl border bg-[color:var(--ui-color-surface)]/95",
    "text-[color:var(--ui-color-foreground)] placeholder:text-[color:var(--ui-color-muted)]",
    "transition-colors duration-150 ease-[var(--ui-motion-easing-standard, ease)]",
    "focus-visible:outline-none focus-visible:ring-[color:var(--ui-color-focus, var(--ui-color-outline))]",
    "focus-visible:ring-[length:var(--ui-focus-ring-width, 2px)]",
    "focus-visible:ring-offset-[length:var(--ui-focus-ring-offset, 2px)]",
    "focus-visible:ring-offset-[color:var(--ui-color-surface)]",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ),
  {
    variants: {
      variant: {
        outline: "border-[color:var(--ui-color-border)]",
        subtle:
          "border-transparent bg-[color:var(--ui-color-surface-muted)]/90",
        ghost: "border-transparent bg-transparent focus-visible:ring-offset-0",
      },
      size: {
        sm: "min-h-[2.5rem] rounded-lg px-3 text-sm",
        md: "min-h-[2.75rem] rounded-xl px-4 text-base",
        lg: "min-h-[3.1rem] rounded-2xl px-5 text-lg",
      },
      status: {
        default: "",
        success:
          "border-[color:var(--ui-color-success)]/45 focus-visible:ring-[color:var(--ui-color-success)]/40",
        warning:
          "border-[color:var(--ui-color-warning)]/60 focus-visible:ring-[color:var(--ui-color-warning)]/50",
        error:
          "border-[color:var(--ui-color-danger)]/60 focus-visible:ring-[color:var(--ui-color-danger)]/55",
      },
      tone: {
        default: "",
        inverted:
          "bg-[color:rgba(255,255,255,0.08)] border-[color:rgba(255,255,255,0.18)]",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
      status: "default",
      tone: "default",
    },
  },
);

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", status = "default", tone, variant, size, ...props },
  ref,
) {
  const ariaInvalid = props["aria-invalid"] ?? (status === "error" ? true : undefined);

  return (
    <input
      type={type}
      ref={ref}
      data-status={status !== "default" ? status : undefined}
      aria-invalid={ariaInvalid}
      className={clsx(inputVariants({ variant, size, status, tone }), className)}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { inputVariants };
