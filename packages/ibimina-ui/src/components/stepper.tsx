import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "../utils/cn";

export interface StepperStep {
  title: ReactNode;
  description?: ReactNode;
  state?: "complete" | "current" | "upcoming";
  optional?: boolean;
}

export interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  onStepChange?: (index: number) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepChange, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "relative flex flex-col gap-4 rounded-[calc(var(--radius-xl)_*_1.1)] border border-white/10 bg-white/5 p-4 text-neutral-0 shadow-glass sm:flex-row sm:items-stretch",
        className
      )}
      role="list"
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const state =
          step.state ??
          (index < currentStep ? "complete" : index === currentStep ? "current" : "upcoming");
        const isClickable = typeof onStepChange === "function" && index <= currentStep;

        return (
          <li
            key={index}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-2xl border border-transparent p-3 transition",
              state === "current" && "border-white/20 bg-white/10 shadow-glass",
              state === "complete" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
              state === "upcoming" && "border-dashed border-white/10 text-neutral-3"
            )}
          >
            <button
              type="button"
              onClick={isClickable ? () => onStepChange(index) : undefined}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition",
                state === "complete"
                  ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                  : state === "current"
                    ? "border-white/30 bg-white/20 text-neutral-0"
                    : "border-white/10 text-neutral-3",
                isClickable
                  ? "cursor-pointer hover:border-white/40 hover:text-neutral-0"
                  : "cursor-default"
              )}
              aria-current={state === "current" ? "step" : undefined}
              aria-disabled={isClickable ? undefined : true}
            >
              {state === "complete" ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              <span className="sr-only">Step {index + 1}</span>
            </button>
            <div className="flex-1 space-y-1 text-left">
              <p className="text-sm font-semibold leading-snug">{step.title}</p>
              {step.description ? (
                <p className="text-xs text-neutral-3">{step.description}</p>
              ) : null}
              {step.optional ? (
                <p className="text-[11px] uppercase tracking-[0.35em] text-neutral-3">Optional</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
