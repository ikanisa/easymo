"use client";

import React from "react";

type TooltipProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

// Lightweight tooltip wrapper using native title attribute for broad compatibility.
export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span title={label} className={className}>
      {children}
    </span>
  );
}

