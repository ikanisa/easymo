import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "block w-full rounded-xl border bg-[color:var(--color-surface)]/95 text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted)] transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        outline: "border-[color:var(--color-border)]",
        subtle: "border-transparent bg-[color:var(--color-surface-muted)]/85",
        ghost: "border-transparent bg-transparent focus-visible:ring-offset-0",
      },
      size: {
        sm: "rounded-lg px-3 py-2 text-body-sm",
        md: "rounded-xl px-4 py-3 text-body",
        lg: "rounded-2xl px-5 py-4 text-body-lg",
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

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, size, status = "default", ...props }, ref) => {
    const ariaInvalid = props["aria-invalid"] ?? (status === "error" ? true : undefined);

    return (
      <textarea
        ref={ref}
        data-status={status !== "default" ? status : undefined}
        aria-invalid={ariaInvalid}
        className={cn(textareaVariants({ variant, size, status }), className)}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
