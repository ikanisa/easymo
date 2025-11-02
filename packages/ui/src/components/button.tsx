"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const buttonRecipe = cva(
  "group relative inline-flex min-w-[2.5rem] items-center justify-center gap-2 overflow-hidden rounded-full border border-transparent px-4 py-2 text-sm font-medium outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--easymo-colors-primary-400)] disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:rgb(var(--easymo-colors-primary-500))] text-white shadow-[0_18px_40px_rgba(14,165,233,0.38)] hover:bg-[color:rgb(var(--easymo-colors-primary-600))]",
        secondary:
          "bg-[color:rgba(var(--easymo-colors-neutral-50),0.75)] text-[color:rgb(var(--easymo-colors-neutral-900))] border-[color:rgba(var(--easymo-colors-neutral-400),0.35)] hover:bg-[color:rgba(var(--easymo-colors-neutral-50),0.95)]",
        ghost:
          "bg-transparent text-[color:rgb(var(--easymo-colors-neutral-900))] hover:bg-[color:rgba(var(--easymo-colors-neutral-100),0.75)]",
        destructive:
          "bg-[color:rgb(var(--easymo-colors-danger-500))] text-white hover:bg-[color:rgb(var(--easymo-colors-danger-600))]",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 p-0",
      },
      tone: {
        default: "",
        outline: "border-[color:rgba(var(--easymo-colors-primary-500),0.35)] bg-transparent text-[color:rgb(var(--easymo-colors-primary-600))]",
      },
    },
    compoundVariants: [
      {
        variant: "primary",
        tone: "outline",
        class: "bg-transparent text-[color:rgb(var(--easymo-colors-primary-600))] hover:bg-[color:rgba(var(--easymo-colors-primary-500),0.1)]",
      },
      {
        variant: "ghost",
        tone: "outline",
        class: "border-[color:rgba(var(--easymo-colors-neutral-400),0.45)]",
      },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      tone: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonRecipe> {
  /**
   * Render the button as a different element using Radix Slot.
   */
  asChild?: boolean;
  /**
   * Optional adornment that appears before the button label.
   */
  leadingIcon?: ReactNode;
  /**
   * Optional adornment that appears after the button label.
   */
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild,
      className,
      children,
      leadingIcon,
      trailingIcon,
      variant,
      tone,
      size,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const content = (
      <span className="inline-flex min-w-0 items-center justify-center gap-2">
        {leadingIcon ? (
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            {leadingIcon}
          </span>
        ) : null}
        <span className="truncate">{children}</span>
        {trailingIcon ? (
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            {trailingIcon}
          </span>
        ) : null}
      </span>
    );

    return (
      <Comp
        ref={ref as never}
        className={clsx(buttonRecipe({ variant, size, tone }), className)}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { buttonRecipe };
