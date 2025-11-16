import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Input as UiInput, type InputProps as UiInputProps } from "@easymo/ui/components/forms";
import { cn } from "@/lib/utils";

const uiKitEnabled = (process.env.NEXT_PUBLIC_UI_V2_ENABLED ?? "false").trim().toLowerCase() === "true";

const legacyInputVariants = cva(
  "block w-full rounded-xl border bg-[color:var(--color-surface)]/95 text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted)] transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        outline: "border-[color:var(--color-border)]",
        subtle: "border-transparent bg-[color:var(--color-surface-muted)]/85",
        ghost: "border-transparent bg-transparent focus-visible:ring-offset-0",
      },
      size: {
        sm: "min-h-[2.5rem] rounded-lg px-3 text-body-sm",
        md: "min-h-[2.75rem] rounded-xl px-4 text-body",
        lg: "min-h-[3.1rem] rounded-2xl px-5 text-body-lg",
      },
      status: {
        default: "",
        success:
          "border-[color:var(--color-success)]/45 focus-visible:ring-[color:var(--color-success)]/40",
        error:
          "border-[color:var(--color-danger)]/60 focus-visible:ring-[color:var(--color-danger)]/45",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
      status: "default",
    },
  },
);

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">;

export interface InputProps extends NativeInputProps, VariantProps<typeof legacyInputVariants>, Partial<UiInputProps> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", variant, size, status = "default", ...props }, ref) => {
    const ariaInvalid = props["aria-invalid"] ?? (status === "error" ? true : undefined);

    if (uiKitEnabled) {
      return (
        <UiInput
          ref={ref}
          type={type}
          status={status as UiInputProps["status"]}
          variant={variant as UiInputProps["variant"]}
          size={size as UiInputProps["size"]}
          aria-invalid={ariaInvalid}
          className={className}
          {...props}
        />
      );
    }

    return (
      <input
        type={type}
        ref={ref}
        data-status={status !== "default" ? status : undefined}
        aria-invalid={ariaInvalid}
        className={cn(legacyInputVariants({ variant, size, status }), className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, legacyInputVariants as inputVariants };
