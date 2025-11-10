"use client";

import clsx from "clsx";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  status: "complete" | "current" | "upcoming";
}

export interface WizardProps {
  steps: WizardStep[];
  className?: string;
}

export function Wizard({ steps, className }: WizardProps) {
  const progress = Math.round(
    (steps.filter((step) => step.status === "complete").length / Math.max(1, steps.length)) * 100,
  );

  return (
    <section
      className={clsx(
        "flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
      aria-label="Workflow progress"
    >
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Workflow</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{progress}% complete</p>
        </div>
        <div className="relative h-2 w-32 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      </header>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-start gap-3"
            aria-current={step.status === "current" ? "step" : undefined}
          >
            <span
              className={clsx(
                "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                step.status === "complete"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : step.status === "current"
                  ? "border-blue-500 text-blue-600"
                  : "border-slate-300 text-slate-400",
              )}
            >
              {step.status === "complete" ? "✓" : index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{step.title}</p>
              {step.description ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

