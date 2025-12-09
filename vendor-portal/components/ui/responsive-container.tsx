import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  padding?: boolean;
}

const sizeClasses = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

/**
 * ResponsiveContainer - A responsive container component with consistent spacing
 *
 * Features:
 * - Multiple size presets (sm, md, lg, xl, full)
 * - Optional padding for consistent spacing
 * - Responsive margin and padding
 * - Accessible layout structure
 */
export function ResponsiveContainer({
  children,
  className,
  size = "lg",
  padding = true,
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        sizeClasses[size],
        padding && "px-4 py-6 md:px-8 md:py-8",
        className
      )}
    >
      {children}
    </div>
  );
}
