import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { Card, CardHeader, type CardPadding } from "./card";

export interface GlassCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  padding?: CardPadding;
  children: ReactNode;
}

export function GlassCard({
  title,
  subtitle,
  actions,
  className,
  padding = "md",
  children,
}: GlassCardProps) {
  return (
    <Card
      surface="elevated"
      padding={padding}
      className={cn("border border-border shadow-md", className)}
    >
      {(title || subtitle || actions) && (
        <CardHeader title={title} description={subtitle} actions={actions} />
      )}
      {children}
    </Card>
  );
}
