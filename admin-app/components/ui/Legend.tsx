"use client";

import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";

type LegendItem = {
  label: string;
  variant?: "gray" | "blue" | "green" | "red" | "yellow" | "slate";
  tooltip?: string;
};

interface LegendProps {
  items: LegendItem[];
  className?: string;
  prefix?: string;
}

export function Legend({ items, className, prefix = "Legend:" }: LegendProps) {
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)] ${className ?? ""}`}>
      <span>{prefix}</span>
      {items.map((item) => (
        <Tooltip key={item.label} label={item.tooltip ?? item.label}>
          <Badge variant={item.variant ?? "gray"}>{item.label}</Badge>
        </Tooltip>
      ))}
    </div>
  );
}

