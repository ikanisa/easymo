"use client";

import clsx from "clsx";

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category?: string;
  enabled?: boolean;
}

export interface ToolsGridProps {
  tools: AgentTool[];
  onToggle?: (tool: AgentTool) => void;
  className?: string;
}

export function ToolsGrid({ tools, onToggle, className }: ToolsGridProps) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Tools</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Toggle capabilities surfaced to this agent.</p>
        </div>
        <span className="text-xs text-slate-400" aria-live="polite">
          {tools.filter((tool) => tool.enabled).length} enabled
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={onToggle ? () => onToggle(tool) : undefined}
            disabled={!onToggle}
            className={clsx(
              "flex h-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
              tool.enabled
                ? "border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-400/80 dark:bg-blue-500/10 dark:text-blue-100"
                : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-blue-200 hover:bg-white dark:border-slate-800/60 dark:bg-slate-800/60 dark:text-slate-200",
            )}
            aria-pressed={tool.enabled}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {tool.category ?? "Utility"}
              </div>
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  tool.enabled
                    ? "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                )}
              >
                {tool.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium">{tool.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tool.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

