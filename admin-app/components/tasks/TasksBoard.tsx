"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mockWorkflowBoard, mockInsuranceRequests } from "@/lib/mock-data";

interface WorkflowTask {
  id: string;
  title: string;
  stage: string;
  owner: string;
  dueAt: string | null;
  status: "open" | "in_progress" | "blocked" | "completed";
  priority: "low" | "medium" | "high";
  relatedRequestId?: string | null;
}

const stageOrder = ["Intake", "Quote", "Payments", "Issuance"];

const statusVariant: Record<WorkflowTask["status"], ComponentProps<typeof Badge>["variant"]> = {
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
  return stageOrder.map((stage) => ({
    stage,
    tasks: tasks.filter((task) => task.stage === stage),
  }));
}

export function TasksBoard() {
  const [selected, setSelected] = useState<WorkflowTask | null>(null);
  const grouped = useMemo(() => groupByStage(mockWorkflowBoard as WorkflowTask[]), []);

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
                    <span className={`rounded-full px-2 py-0.5 text-xs ${priorityTone[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[color:var(--color-muted)]">
                    <span>{task.owner}</span>
                    <span>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No due"}</span>
                  </div>
                </button>
              ))}
              {!column.tasks.length && (
                <p className="rounded-xl border border-dashed border-[color:var(--color-border)] p-3 text-center text-xs text-[color:var(--color-muted)]">
                  No tasks queued.
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
            {selected.relatedRequestId && (
              <div className="rounded-lg border border-[color:var(--color-border)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Request link</p>
                <p className="font-medium">{selected.relatedRequestId}</p>
                <p className="text-xs text-[color:var(--color-muted)]">
                  {mockInsuranceRequests.find((request) => request.id === selected.relatedRequestId)?.customerName ?? "Customer unknown"}
                </p>
              </div>
            )}
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
