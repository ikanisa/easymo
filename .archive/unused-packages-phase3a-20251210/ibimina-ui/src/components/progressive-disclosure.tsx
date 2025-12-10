"use client";

import { useState, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface DisclosureSection {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  defaultExpanded?: boolean;
  required?: boolean;
}

export interface ProgressiveDisclosureProps {
  sections: DisclosureSection[];
  expandMode?: "single" | "multiple";
  onSectionToggle?: (id: string, expanded: boolean) => void;
  className?: string;
}

export function ProgressiveDisclosure({
  sections,
  expandMode = "multiple",
  onSectionToggle,
  className,
}: ProgressiveDisclosureProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.filter((s) => s.defaultExpanded).map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      const isExpanding = !prev.has(id);

      if (expandMode === "single") {
        next.clear();
        if (isExpanding) next.add(id);
      } else {
        if (isExpanding) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      onSectionToggle?.(id, isExpanding);
      return next;
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section, index) => (
        <DisclosurePanel
          key={section.id}
          section={section}
          isExpanded={expandedSections.has(section.id)}
          onToggle={() => toggleSection(section.id)}
          index={index + 1}
        />
      ))}
    </div>
  );
}

interface DisclosurePanelProps {
  section: DisclosureSection;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}

function DisclosurePanel({ section, isExpanded, onToggle, index }: DisclosurePanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200",
        isExpanded
          ? "border-atlas-blue/30 bg-atlas-blue/5 dark:border-atlas-blue/40 dark:bg-atlas-blue/10"
          : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/50 rounded-xl"
        aria-expanded={isExpanded}
        aria-controls={`section-${section.id}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
              isExpanded
                ? "bg-atlas-blue text-white dark:bg-atlas-blue"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
            )}
          >
            {index}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                {section.title}
              </h3>
              {section.required && (
                <span className="text-xs text-red-600 dark:text-red-400">*</span>
              )}
            </div>
            {section.description && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {section.description}
              </p>
            )}
          </div>
        </div>
        <svg
          className={cn(
            "h-5 w-5 flex-shrink-0 transition-transform duration-200 text-neutral-400",
            isExpanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div
          id={`section-${section.id}`}
          className="border-t border-neutral-200 p-4 dark:border-neutral-700"
        >
          {section.content}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-step form with progressive disclosure
 */
export interface StepFormProps {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
    content: ReactNode;
    validation?: () => boolean | Promise<boolean>;
  }>;
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete?: () => void;
  className?: string;
}

export function StepForm({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  className,
}: StepFormProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleNext = async () => {
    const step = steps[currentStep];
    if (step.validation) {
      const isValid = await step.validation();
      if (!isValid) return;
    }

    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-1 items-center">
            <button
              onClick={() => index <= currentStep && onStepChange(index)}
              disabled={index > currentStep}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                index === currentStep && "bg-atlas-blue text-white",
                index < currentStep && "bg-green-500 text-white cursor-pointer",
                index > currentStep &&
                  "bg-neutral-200 text-neutral-400 cursor-not-allowed dark:bg-neutral-700"
              )}
            >
              {completedSteps.has(index) ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 transition-colors",
                  index < currentStep ? "bg-green-500" : "bg-neutral-200 dark:bg-neutral-700"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {steps[currentStep].title}
        </h2>
        {steps[currentStep].description && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {steps[currentStep].description}
          </p>
        )}
        <div className="mt-6">{steps[currentStep].content}</div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={cn(
            "rounded-lg px-6 py-2 font-medium transition-colors",
            currentStep === 0
              ? "cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
              : "bg-white text-neutral-900 hover:bg-neutral-100 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:border-neutral-700"
          )}
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-atlas-blue px-6 py-2 font-medium text-white transition-colors hover:bg-atlas-blue-dark"
        >
          {currentStep === steps.length - 1 ? "Complete" : "Continue"}
        </button>
      </div>
    </div>
  );
}
