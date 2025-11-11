"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { mockAgentPlaybooks } from "@/lib/mock-data";

interface Playbook {
  id: string;
  title: string;
  audience: string;
  summary: string;
  steps: string[];
}

export function InstructionsPlaybooks() {
  const [selected, setSelected] = useState<Playbook | null>(null);
  const playbooks = mockAgentPlaybooks as Playbook[];

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
