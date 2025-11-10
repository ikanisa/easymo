"use client";

import { SectionCard } from "@/components/ui/SectionCard";
import { mockAnalyticsDashboards } from "@/lib/mock-data";

interface AnalyticsWidget {
  id: string;
  title: string;
  timeframe: string;
  primary: string;
  breakdown: Array<{ label: string; value: string }>;
}

export function AnalyticsDashboards() {
  const widgets = mockAnalyticsDashboards as AnalyticsWidget[];

  return (
    <SectionCard
      title="Analytics dashboards"
      description="Monitor conversion, SLA, and revenue trends across the insurance lifecycle."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
              <span>{widget.timeframe}</span>
              <span className="font-medium text-[color:var(--color-foreground)]">{widget.primary}</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold">{widget.title}</h3>
            <ul className="mt-3 space-y-1 text-sm">
              {widget.breakdown.map((item) => (
                <li key={item.label} className="flex justify-between">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
