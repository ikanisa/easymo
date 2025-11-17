"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
// Live data only; no mock imports

type WorkflowTask = {
  id: string;
  title: string;
  status: string;
  owner?: string;
  dueAt: string | null;
  priority?: "low" | "medium" | "high";
  agentName?: string;
};

const stageOrder = ["open", "in_progress", "blocked", "completed"];

const statusVariant: Record<string, ComponentProps<typeof Badge>["variant"]> = {
  open: "outline",
  in_progress: "warning",
  blocked: "destructive",
  completed: "success",
};

const priorityTone: Record<WorkflowTask["priority"], string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

function groupByStage(tasks: WorkflowTask[]) {
  const map: Record<string, WorkflowTask[]> = {};
  for (const t of tasks) {
    const key = (t.status || "open").toLowerCase();
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  const keys = Array.from(new Set([...stageOrder, ...Object.keys(map)]));
  return keys.map((stage) => ({ stage, tasks: map[stage] ?? [] }));
}

export function TasksBoard() {
  const [selected, setSelected] = useState<WorkflowTask | null>(null);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/agent-tasks", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load tasks");
        const json = await res.json();
        const rows = Array.isArray(json?.tasks) ? json.tasks : [];
        const mapped: WorkflowTask[] = rows.map((row: any) => ({
          id: String(row.id),
          title: String(row.title ?? row.agentName ?? "Task"),
          status: String(row.status ?? "open").toLowerCase(),
          owner: row.agentName ?? undefined,
          dueAt: (row.dueAt as string | null | undefined) ?? null,
          priority: undefined,
          agentName: row.agentName ?? undefined,
        }));
        if (mounted) setTasks(mapped);
      } catch {
        if (mounted) setTasks([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => groupByStage(tasks), [tasks]);

  return (
    <SectionCard
      title="Tasks and workflows"
      description="Coordinate intake, pricing, payments, and issuance workstreams in one shared board."
    >
      <div className="grid gap-4 lg:grid-cols-4">
        {grouped.map((column) => (
          <div
            key={column.stage}
            className="flex h-full flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                {column.stage}
              </h3>
              <Badge variant="outline">{column.tasks.length}</Badge>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {column.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelected(task)}
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-3 py-2 text-left text-sm transition hover:border-[color:var(--color-accent)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{task.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${task.priority ? priorityTone[task.priority] : "bg-slate-100 text-slate-600"}`}>
                      {task.priority ?? "normal"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[color:var(--color-muted)]">
                    <span>{task.owner ?? task.agentName ?? "Unassigned"}</span>
                    <span>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No due"}</span>
                  </div>
                </button>
              ))}
              {!column.tasks.length && (
                <p className="rounded-xl border border-dashed border-[color:var(--color-border)] p-3 text-center text-xs text-[color:var(--color-muted)]">
                  {loading ? "Loading…" : "No tasks queued."}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <Drawer title={selected.title} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge variant={statusVariant[selected.status]}>{selected.status.replace(/_/g, " ")}</Badge>
              <span className={`rounded-full px-2 py-0.5 text-xs ${priorityTone[selected.priority]}`}>
                {selected.priority} priority
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Owner</p>
              <p className="font-medium">{selected.owner}</p>
            </div>
            {selected.dueAt && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Due</p>
                <p>{new Date(selected.dueAt).toLocaleString()}</p>
              </div>
            )}
            {/* No cross-links to mock requests */}
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Workflow tips</p>
              <ul className="list-disc space-y-1 pl-4 pt-2">
                <li>Update Supabase `insurance_tasks` status when completed.</li>
                <li>Leave a note for the next pod if blockers remain.</li>
              </ul>
            </div>
            <Button
              variant="primary"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Mark as completed
            </Button>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
