"use client";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";

interface MarketplaceRequestWizardProps {
  agentType: string;
  flowType: string;
  title: string;
  description: string;
  placeholderItems?: string[];
}

interface WizardState {
  msisdn: string;
  location: string;
  itemsRaw: string;
  notes: string;
}

const STEPS = ["Request", "Location", "Review"] as const;
type WizardStep = (typeof STEPS)[number];

const DEFAULT_STATE: WizardState = {
  msisdn: "",
  location: "",
  itemsRaw: "",
  notes: "",
};

export function MarketplaceRequestWizard({
  agentType,
  flowType,
  title,
  description,
  placeholderItems = [],
}: MarketplaceRequestWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const { pushToast } = useToast();

  const items = useMemo(
    () =>
      state.itemsRaw
        .split(/\n|,/)
        .map((line) => line.trim())
        .filter(Boolean),
    [state.itemsRaw],
  );

  const mutation = useMutation({
    mutationKey: ["create-marketplace-session", agentType, flowType],
    mutationFn: async () => {
      const response = await fetch("/api/agent-orchestration/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_type: agentType,
          flow_type: flowType,
          sla_minutes: 5,
          request_data: {
            customer_msisdn: state.msisdn || undefined,
            location_text: state.location || undefined,
            items,
            notes: state.notes || undefined,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(payload.message ?? "Failed to create request");
      }

      return response.json();
    },
    onSuccess: () => {
      pushToast({
        title: "Sourcing request dispatched",
        description: "Marketplace agent is engaging vendors now.",
      });
      setState(DEFAULT_STATE);
      setStepIndex(0);
    },
    onError: (error: unknown) => {
      pushToast({
        title: "Unable to start request",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "error",
      });
    },
  });

  const currentStep: WizardStep = STEPS[stepIndex];

  const canAdvance = useMemo(() => {
    if (currentStep === "Request") {
      return items.length > 0;
    }
    if (currentStep === "Location") {
      return Boolean(state.msisdn);
    }
    return true;
  }, [currentStep, items.length, state.msisdn]);

  return (
    <div className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">{title}</h3>
          <p className="text-sm text-[color:var(--color-muted)]">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
          {STEPS.map((step, index) => (
            <span
              key={step}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border",
                index === stepIndex
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)] bg-white",
              )}
            >
              {index + 1}
            </span>
          ))}
        </div>
      </div>

      {currentStep === "Request" ? (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[color:var(--color-foreground)]">
            Requested items
            <Textarea
              value={state.itemsRaw}
              onChange={(event) => setState((prev) => ({ ...prev, itemsRaw: event.target.value }))}
              placeholder={placeholderItems.join(", ") || "e.g. Amoxicillin 500mg"}
              rows={4}
              className="mt-2"
            />
          </label>
          <label className="block text-sm font-medium text-[color:var(--color-foreground)]">
            Notes (optional)
            <Textarea
              value={state.notes}
              onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Add delivery instructions or budget targets"
              rows={3}
              className="mt-2"
            />
          </label>
        </div>
      ) : null}

      {currentStep === "Location" ? (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[color:var(--color-foreground)]">
            Customer WhatsApp number
            <Input
              value={state.msisdn}
              onChange={(event) => setState((prev) => ({ ...prev, msisdn: event.target.value }))}
              placeholder="+2507..."
              className="mt-2"
            />
          </label>
          <label className="block text-sm font-medium text-[color:var(--color-foreground)]">
            Location or landmark
            <Input
              value={state.location}
              onChange={(event) => setState((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="Kigali Heights, KG 7 Ave"
              className="mt-2"
            />
          </label>
        </div>
      ) : null}

      {currentStep === "Review" ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/70 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[color:var(--color-muted)]">WhatsApp</span>
            <span className="font-medium text-[color:var(--color-foreground)]">{state.msisdn || "Not provided"}</span>
          </div>
          <div>
            <p className="text-[color:var(--color-muted)]">Items</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {items.map((item) => (
                <li key={item} className="text-[color:var(--color-foreground)]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[color:var(--color-muted)]">Location</span>
            <span className="font-medium text-[color:var(--color-foreground)]">{state.location || "TBD"}</span>
          </div>
          {state.notes ? (
            <div>
              <p className="text-[color:var(--color-muted)]">Notes</p>
              <p className="mt-1 text-[color:var(--color-foreground)]">{state.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={stepIndex === 0 || mutation.isPending}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (currentStep === "Review") {
              mutation.mutate();
            } else {
              setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
            }
          }}
          disabled={!canAdvance || mutation.isPending}
        >
          {mutation.isPending ? "Dispatching…" : currentStep === "Review" ? "Start sourcing" : "Next"}
        </Button>
      </div>
    </div>
  );
}
