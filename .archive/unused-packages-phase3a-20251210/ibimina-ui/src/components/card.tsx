"use client";

import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../utils/cn";

type CardVariant = "default" | "bordered" | "elevated";
type CardPadding = "none" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "bg-white border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-700",
  bordered: "bg-white border-2 border-neutral-300 dark:bg-neutral-900 dark:border-neutral-600",
  elevated: "bg-white border border-neutral-200 shadow-md dark:bg-neutral-900 dark:border-neutral-700 dark:shadow-xl",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hover?: boolean;
  interactive?: boolean;
  asChild?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    variant = "default",
    padding = "md",
    hover = false,
    interactive = false,
    asChild = false,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl transition-all duration-200",
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        hover && "hover:shadow-lg hover:border-neutral-300 hover:-translate-y-0.5 dark:hover:border-neutral-600 dark:hover:shadow-2xl",
        interactive && "cursor-pointer",
        className
      )}
      {...props}
    />
  );
});

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { className, title, description, action, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("flex items-start justify-between gap-4 mb-4", className)}
      {...props}
    >
      <div className="flex-1 space-y-1">
        {title && <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">{title}</h3>}
        {description && <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-normal">{description}</p>}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
});

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(function CardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn("text-neutral-700 dark:text-neutral-300", className)} {...props} />;
});

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700", className)}
      {...props}
    />
  );
});
