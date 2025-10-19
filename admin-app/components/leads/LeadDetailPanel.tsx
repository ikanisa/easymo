"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/ToastProvider";
import type { Lead } from "@/lib/schemas";
import { useLeadUpdateMutation } from "@/lib/queries/leads";

interface LeadDetailPanelProps {
  lead: Lead | null;
}

export function LeadDetailPanel({ lead }: LeadDetailPanelProps) {
  const { pushToast } = useToast();
  const mutation = useLeadUpdateMutation();
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [optIn, setOptIn] = useState(true);

  useEffect(() => {
    if (!lead) {
      setName("");
      setTags("");
      setOptIn(true);
      return;
    }
    setName(lead.name ?? "");
    setTags(lead.tags.join(", "));
    setOptIn(lead.optIn);
  }, [lead]);

  if (!lead) {
    return (
      <SectionCard
        title="Select a lead"
        description="Choose a lead from the roster to view details and make updates."
      />
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate(
      {
        tenantId: lead.tenantId,
        phone: lead.phoneE164,
        name: name.trim() || undefined,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        optIn,
      },
      {
        onSuccess: () => {
          pushToast({
            title: "Lead updated",
            description: `Saved changes for ${lead.phoneE164}.`,
            tone: "positive",
          });
        },
        onError: (error) => {
          pushToast({
            title: "Update failed",
            description: error instanceof Error ? error.message : "Unknown error",
            tone: "negative",
          });
        },
      },
    );
  };

  return (
    <SectionCard
      title="Lead details"
      description="Update tags, name, and opt-in preferences. Actions sync with Agent Core tools."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-[color:var(--color-muted)]">
            Phone
          </label>
          <div className="mt-1 text-base font-semibold text-[color:var(--color-foreground)]">
            {lead.phoneE164}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="font-medium text-[color:var(--color-muted)]">Display name</span>
            <input
              className="mt-1 rounded-xl border border-[color:var(--color-border)] bg-transparent px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium text-[color:var(--color-muted)]">Tags</span>
            <input
              className="mt-1 rounded-xl border border-[color:var(--color-border)] bg-transparent px-3 py-2"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Comma separated"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(event) => setOptIn(event.target.checked)}
          />
          Opted in to messaging
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isLoading}>
            Save changes
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isLoading}
            onClick={() => {
              setName(lead.name ?? "");
              setTags(lead.tags.join(", "));
              setOptIn(lead.optIn);
            }}
          >
            Reset
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
