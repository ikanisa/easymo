import classNames from "classnames";

import { GlassPanel } from "@/components/layout/GlassPanel";

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  muted?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  muted = false,
  padding = "lg",
}: SectionCardProps) {
  return (
    <GlassPanel
      padding={padding}
      muted={muted}
      className={classNames("flex flex-col gap-6", className)}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-[color:var(--color-foreground)]">
            {title}
          </h2>
          {description
            ? (
              <p className="max-w-prose text-sm text-[color:var(--color-muted)]">
                {description}
              </p>
            )
            : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="relative">
        {children}
      </div>
    </GlassPanel>
  );
}
