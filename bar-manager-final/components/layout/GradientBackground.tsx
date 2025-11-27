import classNames from "classnames";
import { ReactNode } from "react";

interface GradientBackgroundProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "surface";
  className?: string;
}

const variantMap: Record<
  NonNullable<GradientBackgroundProps["variant"]>,
  string
> = {
  primary:
    "bg-[radial-gradient(circle_at_top,_var(--gradient-primary-start)_0%,_transparent_65%)]",
  secondary:
    "bg-[radial-gradient(circle_at_bottom,_var(--gradient-secondary-start)_0%,_transparent_70%)]",
  surface:
    "bg-[linear-gradient(160deg,_var(--gradient-surface-start),_var(--gradient-surface-end))]",
};

export function GradientBackground(
  { children, variant = "surface", className }: GradientBackgroundProps,
) {
  return (
    <div
      className={classNames(
        "relative isolate overflow-hidden",
        variantMap[variant],
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_rgba(59,_130,_246,_0.18),_transparent_60%)] mix-blend-screen" />
      <div className="relative z-[1]">
        {children}
      </div>
    </div>
  );
}
