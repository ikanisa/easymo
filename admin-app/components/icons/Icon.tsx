"use client";

import { createElement, forwardRef } from "react";
import * as Icons from "lucide-react";

export type IconName = keyof typeof Icons;

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  name: IconName;
  label?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  function Icon({ name, label, ...props }, ref) {
    const LucideIcon = Icons[name] ?? Icons.HelpCircle;
    const ariaLabel = label ?? name.replace(/([A-Z])/g, " $1").trim();

    return createElement(LucideIcon as any, {
      ref,
      "aria-label": ariaLabel,
      role: label ? "img" : undefined,
      ...props,
    });
  },
);
