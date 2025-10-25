"use client";

import React from "react";

type BadgeVariant = "gray" | "blue" | "green" | "red" | "yellow" | "slate";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  gray: "bg-gray-100 text-gray-900",
  blue: "bg-blue-100 text-blue-900",
  green: "bg-green-100 text-green-900",
  red: "bg-red-100 text-red-900",
  yellow: "bg-yellow-100 text-yellow-900",
  slate: "bg-slate-100 text-slate-900",
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  const base = "inline-block rounded px-2 py-0.5 text-xs";
  const cls = `${base} ${VARIANT_CLASSES[variant]} ${className ?? ""}`.trim();
  return <span className={cls}>{children}</span>;
}

