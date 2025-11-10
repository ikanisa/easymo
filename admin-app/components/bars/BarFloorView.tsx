"use client";

import type { BarFloorTable } from "@/lib/bars/bars-dashboard-service";
import { EmptyState } from "@/components/ui/EmptyState";

interface BarFloorViewProps {
  tables: BarFloorTable[];
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString();
}

export function BarFloorView({ tables }: BarFloorViewProps) {
  if (!tables.length) {
    return <EmptyState title="No table telemetry" description="Open orders will populate the floor plan." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((table) => (
        <div
          key={table.table}
          className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-[color:var(--color-foreground)]">{table.table}</h4>
            <span className="rounded-full bg-[color:var(--color-surface-muted)] px-3 py-1 text-xs text-[color:var(--color-muted)]">
              {table.openOrders} open
            </span>
          </div>
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            Last order {formatTime(table.lastOrderAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
