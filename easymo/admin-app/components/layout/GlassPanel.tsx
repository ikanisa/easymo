import { ReactNode } from "react";
import classNames from "classnames";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  muted?: boolean;
}

const paddingTokens = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassPanel(
  { children, className, padding = "md", muted = false }: GlassPanelProps,
) {
  return (
    <section
      className={classNames(
        "relative rounded-2xl border transition-shadow duration-200",
        muted ? "glass-surface-muted" : "glass-surface",
        paddingTokens[padding],
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl gradient-border" />
      <div className="relative z-[1]">
        {children}
      </div>
    </section>
  );
}
