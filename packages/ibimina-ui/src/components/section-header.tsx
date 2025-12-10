import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-neutral-0">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="text-xs text-neutral-2">{subtitle}</p>}
    </header>
  );
}
