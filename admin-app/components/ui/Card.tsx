import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "group relative rounded-2xl border border-[color:var(--color-border)]/65 bg-[color:var(--color-surface)]/85 text-[color:var(--color-foreground)] shadow-[var(--shadow-ambient)]/14 transition-all duration-[var(--motion-duration-medium)] ease-[var(--motion-ease-standard)]",
  {
    variants: {
      variant: {
        surface: "bg-[color:var(--color-surface)]/85",
        outline: "bg-transparent border-[color:var(--color-border)]",
        glass:
          "border-[color:var(--glass-border)]/40 bg-[color:var(--color-surface)]/70 backdrop-blur-[var(--glass-blur-soft)]",
      },
      elevation: {
        none: "shadow-none",
        sm: "shadow-[var(--shadow-ambient)]/16",
        md: "shadow-[var(--shadow-floating)]/20",
      },
      interactive: {
        false: "",
        true: "hover:-translate-y-[2px] hover:shadow-[var(--shadow-floating)]/28 focus-within:shadow-[var(--shadow-floating)]/32",
      },
    },
    defaultVariants: {
      variant: "surface",
      elevation: "sm",
      interactive: false,
    },
  },
);

const cardSectionPadding = cva("", {
  variants: {
    padding: {
      none: "p-0",
      sm: "px-4 py-4",
      md: "px-6 py-5",
      lg: "px-8 py-6",
    },
  },
  defaultVariants: {
    padding: "md",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, elevation, interactive, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(cardVariants({ variant, elevation, interactive }), className)}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

export interface CardSectionProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardSectionPadding> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 border-b border-[color:var(--color-border)]/50",
        cardSectionPadding({ padding }),
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-heading-sm tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-body-sm text-muted", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-4", cardSectionPadding({ padding }), className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, CardSectionProps>(
  ({ className, padding = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-row items-center justify-end gap-3 border-t border-[color:var(--color-border)]/50",
        cardSectionPadding({ padding }),
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { cardVariants };
