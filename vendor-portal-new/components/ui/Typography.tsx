"use client";

import { forwardRef, type ElementType, type ReactNode } from "react";
import type { ComponentPropsWithoutRef, Ref } from "react";

import { cn } from "@/lib/utils";

export type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body-lg"
  | "body"
  | "body-sm"
  | "caption";

export type TypographyTone =
  | "default"
  | "muted"
  | "subtle"
  | "inverse"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type TypographyWeight = "regular" | "medium" | "semibold" | "bold";
export type TypographyAlign = "start" | "center" | "end" | "justify";

const VARIANT_CLASS_MAP: Record<TypographyVariant, string> = {
  h1: "typography-h1",
  h2: "typography-h2",
  h3: "typography-h3",
  h4: "typography-h4",
  h5: "typography-h5",
  h6: "typography-h6",
  "body-lg": "typography-body-lg",
  body: "typography-body",
  "body-sm": "typography-body-sm",
  caption: "typography-caption",
};

const DEFAULT_ELEMENT_MAP: Record<TypographyVariant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  "body-lg": "p",
  body: "p",
  "body-sm": "p",
  caption: "span",
};

const TONE_CLASS_MAP: Record<TypographyTone, string> = {
  default: "typography-tone-default",
  muted: "typography-tone-muted",
  subtle: "typography-tone-subtle",
  inverse: "typography-tone-inverse",
  success: "typography-tone-success",
  warning: "typography-tone-warning",
  danger: "typography-tone-danger",
  info: "typography-tone-info",
};

const ALIGN_CLASS_MAP: Record<TypographyAlign, string> = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
  justify: "text-justify",
};

const WEIGHT_CLASS_MAP: Record<TypographyWeight, string> = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

type BaseTypographyProps<T extends ElementType> = {
  as?: T;
  variant?: TypographyVariant;
  tone?: TypographyTone;
  weight?: TypographyWeight;
  align?: TypographyAlign;
  inline?: boolean;
  children?: ReactNode;
  className?: string;
};

export type TypographyProps<T extends ElementType> = BaseTypographyProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof BaseTypographyProps<T> | "color">;

type TypographyComponent = <T extends ElementType = HTMLElement>(
  props: TypographyProps<T> & { ref?: Ref<Element> }
) => React.ReactElement | null;

const TypographyBase = <T extends ElementType = HTMLElement>(
  {
    as,
    variant = "body",
    tone = "default",
    weight,
    align = "start",
    inline = false,
    className,
    children,
    ...rest
  }: TypographyProps<T>,
  ref: Ref<Element>
) => {
  const Component = (as ?? DEFAULT_ELEMENT_MAP[variant] ?? "span") as ElementType;

  return (
    <Component
      ref={ref as Ref<Element>}
      data-typography
      className={cn(
        VARIANT_CLASS_MAP[variant],
        !inline && "typography-flow",
        tone ? TONE_CLASS_MAP[tone] : null,
        weight ? WEIGHT_CLASS_MAP[weight] : null,
        ALIGN_CLASS_MAP[align],
        className
      )}
      {...(rest as ComponentPropsWithoutRef<T>)}
    >
      {children}
    </Component>
  );
};

export const Typography = forwardRef(TypographyBase) as TypographyComponent;
