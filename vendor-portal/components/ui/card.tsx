import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

import { Card as UiCard, CardContent, CardFooter, CardHeader } from "@ibimina/ui";

import { cn } from "@/lib/utils";

type CardRadius = "md" | "lg" | "xl";
export type CardSurface = "base" | "subtle" | "contrast" | "elevated" | "translucent";

const SURFACE_CLASSES: Record<CardSurface, string> = {
  base: "",
  subtle: "border border-[var(--color-border-subtle)]",
  contrast: "border border-transparent",
  elevated: "shadow-md border border-[var(--color-border)]",
  translucent: "backdrop-saturate-150 border border-[var(--surface-glass-border)]",
};

const RADIUS_CLASSES: Record<CardRadius, string> = {
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: CardSurface;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  radius?: CardRadius;
}

export type CardPadding = NonNullable<CardProps["padding"]>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { surface = "base", padding = "md", interactive = false, radius = "xl", className, ...rest },
  ref
) {
  return (
    <UiCard
      ref={ref}
      padding={padding}
      className={cn(
        SURFACE_CLASSES[surface],
        RADIUS_CLASSES[radius],
        interactive ? "transition hover:-translate-y-0.5 hover:shadow-lg" : null,
        className
      )}
      {...rest}
    />
  );
});

export { CardHeader, CardContent, CardFooter };
