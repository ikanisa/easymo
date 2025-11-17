"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface IntegrationTool {
  id: string;
  name: string;
  category: string;
  status: "connected" | "warning" | "disconnected";
  lastSyncAt: string | null;
  description: string;
}

const statusVariant: Record<IntegrationTool["status"], ComponentProps<typeof Badge>["variant"]> = {
  connected: "success",
  warning: "warning",
  disconnected: "destructive",
};

export function ToolsIntegrationsPanel() {
  const [selected, setSelected] = useState<IntegrationTool | null>(null);
  const tools = useMemo<IntegrationTool[]>(() => [], []);

  return (
    <SectionCard
      title="Tools and integrations"
      description="Track integration health, sync windows, and permissions for partner systems."
    >
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Tool</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last sync</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {tools.map((tool) => (
              <tr key={tool.id}>
                <td className="px-4 py-3 font-medium">{tool.name}</td>
                <td className="px-4 py-3">{tool.category}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[tool.status]}>{tool.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {tool.lastSyncAt ? new Date(tool.lastSyncAt).toLocaleString() : "Never"}
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => setSelected(tool)}>
                    View details
                  </Button>
                </td>
              </tr>
            ))}
            {!tools.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[color:var(--color-muted)]">
                  No integrations configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer title={selected.name} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Status</p>
              <Badge variant={statusVariant[selected.status]}>{selected.status}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Description</p>
              <p>{selected.description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Last sync</p>
              <p>{selected.lastSyncAt ? new Date(selected.lastSyncAt).toLocaleString() : "Never"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Refresh connection</Button>
              <Button variant="ghost">View audit log</Button>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
