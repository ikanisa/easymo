"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";

interface Playbook {
  id: string;
  title: string;
  audience: string;
  summary: string;
  steps: string[];
}

export function InstructionsPlaybooks() {
  const [selected, setSelected] = useState<Playbook | null>(null);
  const playbooks: Playbook[] = [];

  return (
    <SectionCard
      title="Instructions and playbooks"
      description="Codify best practices for every pod with actionable, searchable playbooks."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {playbooks.map((playbook) => (
          <button
            key={playbook.id}
            type="button"
            onClick={() => setSelected(playbook)}
            className="h-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left transition hover:border-[color:var(--color-accent)]"
          >
            <Badge variant="outline">{playbook.audience}</Badge>
            <h3 className="mt-3 text-lg font-semibold">{playbook.title}</h3>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">{playbook.summary}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
              {playbook.steps.length} steps
            </p>
          </button>
        ))}
        {!playbooks.length && (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted)]">
            No playbooks available.
          </div>
        )}
      </div>

      {selected && (
        <Drawer title={selected.title} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <Badge variant="outline">{selected.audience}</Badge>
            <p>{selected.summary}</p>
            <ol className="list-decimal space-y-2 pl-5">
              {selected.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
