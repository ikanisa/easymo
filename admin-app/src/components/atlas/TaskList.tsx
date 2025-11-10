"use client";

import clsx from "clsx";

export interface AgentTaskItem {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  assignee?: string;
  due?: string;
}

export interface TaskListProps {
  tasks: AgentTaskItem[];
  onToggle?: (task: AgentTaskItem) => void;
  className?: string;
}

const statusCopy: Record<AgentTaskItem["status"], string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

export function TaskList({ tasks, onToggle, className }: TaskListProps) {
  return (
    <section
      className={clsx(
        "flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Tasks</h3>
        <span className="text-xs text-slate-400">{tasks.length} open</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-800/50"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={onToggle ? () => onToggle(task) : undefined}
                disabled={!onToggle}
                className={clsx(
                  "flex flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
                  !onToggle && "cursor-default",
                )}
              >
                <span
                  className={clsx(
                    "mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold uppercase",
                    task.status === "done"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : task.status === "in-progress"
                      ? "border-blue-500 text-blue-600"
                      : "border-slate-300 text-slate-400",
                  )}
                  aria-hidden
                >
                  {task.status === "done" ? "✓" : task.status === "in-progress" ? "…" : ""}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{task.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {statusCopy[task.status] ?? task.status}
                    {task.assignee ? ` • ${task.assignee}` : ""}
                    {task.due ? ` • Due ${new Date(task.due).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

