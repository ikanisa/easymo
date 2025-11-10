"use client";

import { type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { mockAgentOverviewMetrics } from "@/lib/mock-data";

interface AgentMetric {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "flat";
}

const trendVariant: Record<AgentMetric["trend"], React.ComponentProps<typeof Badge>["variant"]> = {
  up: "success",
  down: "destructive",
  flat: "outline",
};

export function AgentOverviewKpis() {
  const metrics = mockAgentOverviewMetrics as AgentMetric[];

  return (
    <SectionCard
      title="Agent overview"
      description="Live KPIs covering insurance pod throughput, SLAs, and follow-up backlog."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
            <Badge className="mt-3" variant={trendVariant[metric.trend]}>
              {metric.change}
            </Badge>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4 text-sm">
        <h3 className="text-sm font-semibold">Workflow guidance</h3>
        <p className="mt-2 text-[color:var(--color-muted)]">
          Use these KPIs to trigger playbooks when turnaround dips or payment backlog spikes. Metrics reflect staged data in Supabase requests and payments tables with RLS-guarded visibility.
        </p>
      </div>
    </SectionCard>
  );
}
