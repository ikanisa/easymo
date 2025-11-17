"use client";

import { useMemo } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";

interface LearningModule {
  id: string;
  title: string;
  durationMinutes: number;
  difficulty: string;
  tags: string[];
  summary: string;
}

export function LearningModules() {
  const modules = useMemo<LearningModule[]>(() => [], []);

  return (
    <SectionCard
      title="Learning modules"
      description="Upskill agents quickly with snackable lessons tuned to insurance workflows."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {modules.map((module) => (
          <div
            key={module.id}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
              <span>{module.durationMinutes} min</span>
              <Badge variant="outline">{module.difficulty}</Badge>
            </div>
            <h3 className="mt-2 text-lg font-semibold">{module.title}</h3>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">{module.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {module.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[color:var(--color-border)]/30 px-2 py-1 text-xs text-[color:var(--color-muted)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!modules.length && (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted)]">
            No learning modules available.
          </div>
        )}
      </div>
    </SectionCard>
  );
}
