"use client";

import { type ComponentProps } from "react";

import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";

interface AdminPanel {
  id: string;
  title: string;
  owner: string;
  description: string;
  lastUpdated: string;
  status: "healthy" | "warning" | "attention";
}

const statusVariant: Record<AdminPanel["status"], React.ComponentProps<typeof Badge>["variant"]> = {
  healthy: "success",
  warning: "warning",
  attention: "outline",
};

export function AdminGovernancePanel() {
  const panels: AdminPanel[] = [];

  return (
    <SectionCard
      title="Settings and admin"
      description="Govern access, review RLS policies, and monitor compliance controls."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
          >
            <Badge variant={statusVariant[panel.status]}>{panel.status}</Badge>
            <h3 className="mt-2 text-lg font-semibold">{panel.title}</h3>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">{panel.description}</p>
            <p className="mt-3 text-xs text-[color:var(--color-muted)]">
              Owner: {panel.owner} • Updated {new Date(panel.lastUpdated).toLocaleString()}
            </p>
          </div>
        ))}
        {!panels.length && (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted)]">
            No governance panels configured.
          </div>
        )}
      </div>
    </SectionCard>
  );
}
