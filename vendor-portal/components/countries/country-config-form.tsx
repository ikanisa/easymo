"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceSection } from "@/components/layout/workspace-layout";
import { FormField, FormLayout } from "@/components/ui/form";
import { useToast } from "@/providers/toast-provider";
import { cn } from "@/lib/utils";
import { MULTICOUNTRY_FEATURES } from "@/lib/multicountry/constants";

type DraftState = {
  referenceFormat: string;
  settlementNotes: string;
  enabledFeatures: string[];
};

type NormalizedState = DraftState;

type PersistedState = NormalizedState & { updatedAt: string | null };

type Status = "idle" | "saving" | "success" | "error";

export interface CountryConfigFormSnapshot {
  draft: NormalizedState;
  saved: PersistedState;
  dirty: boolean;
  status: Status;
  errorMessage: string | null;
}

export interface CountryConfigFormProps {
  countryId: string;
  initialReferenceFormat: string;
  initialSettlementNotes?: string | null;
  initialFeatures?: string[] | null;
  initialUpdatedAt?: string | null;
  onSnapshotChange?: (snapshot: CountryConfigFormSnapshot) => void;
  canEdit?: boolean;
}

const CONTROL_CLASS =
  "w-full rounded-xl border border-neutral-6/60 bg-white/80 px-3 py-2 text-sm text-neutral-12 shadow-sm transition focus:border-kigali focus:outline-none focus:ring-2 focus:ring-kigali/40 disabled:cursor-not-allowed disabled:opacity-70";

function normalizeFeatures(features: string[] | undefined | null): string[] {
  return Array.from(
    new Set(
      (features ?? []).map((feature) => feature.trim()).filter((feature) => feature.length > 0)
    )
  ).sort();
}

function normalizeDraft(draft: DraftState): NormalizedState {
  return {
    referenceFormat: draft.referenceFormat.trim().toUpperCase(),
    settlementNotes: draft.settlementNotes.trim(),
    enabledFeatures: normalizeFeatures(draft.enabledFeatures),
  };
}

function statesEqual(a: NormalizedState, b: NormalizedState) {
  if (a.referenceFormat !== b.referenceFormat) return false;
  if (a.settlementNotes !== b.settlementNotes) return false;
  if (a.enabledFeatures.length !== b.enabledFeatures.length) return false;
  return a.enabledFeatures.every((value, index) => value === b.enabledFeatures[index]);
}

export function CountryConfigForm({
  countryId,
  initialReferenceFormat,
  initialSettlementNotes,
  initialFeatures,
  initialUpdatedAt,
  onSnapshotChange,
  canEdit = true,
}: CountryConfigFormProps) {
  const initialNormalized: PersistedState = {
    referenceFormat: initialReferenceFormat?.trim().toUpperCase() || "C3.D3.S3.G4.M3",
    settlementNotes: initialSettlementNotes?.trim() ?? "",
    enabledFeatures: normalizeFeatures(initialFeatures ?? undefined),
    updatedAt: initialUpdatedAt ?? null,
  };

  const [draft, setDraft] = useState<DraftState>({
    referenceFormat: initialNormalized.referenceFormat,
    settlementNotes: initialNormalized.settlementNotes,
    enabledFeatures: initialNormalized.enabledFeatures,
  });
  const [saved, setSaved] = useState<PersistedState>(initialNormalized);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DraftState, string>>>({});

  const { success, error: showError } = useToast();

  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft]);
  const savedComparable = useMemo<NormalizedState>(
    () => ({
      referenceFormat: saved.referenceFormat,
      settlementNotes: saved.settlementNotes,
      enabledFeatures: saved.enabledFeatures,
    }),
    [saved]
  );

  const dirty = useMemo(
    () => !statesEqual(normalizedDraft, savedComparable),
    [normalizedDraft, savedComparable]
  );

  useEffect(() => {
    onSnapshotChange?.({
      draft: normalizedDraft,
      saved,
      dirty,
      status,
      errorMessage,
    });
  }, [dirty, errorMessage, normalizedDraft, onSnapshotChange, saved, status]);

  const toggleFeature = useCallback((feature: string) => {
    setDraft((prev) => {
      const exists = prev.enabledFeatures.includes(feature);
      return {
        ...prev,
        enabledFeatures: exists
          ? prev.enabledFeatures.filter((entry) => entry !== feature)
          : [...prev.enabledFeatures, feature],
      };
    });
  }, []);

  const validate = useCallback(
    (next: NormalizedState): Partial<Record<keyof DraftState, string>> => {
      const errors: Partial<Record<keyof DraftState, string>> = {};
      if (!next.referenceFormat) {
        errors.referenceFormat = "Reference format is required";
      } else if (!/^[A-Z0-9.\-]{5,64}$/.test(next.referenceFormat)) {
        errors.referenceFormat = "Use 5-64 characters (A-Z, 0-9, period or dash)";
      }
      if (next.settlementNotes.length > 1000) {
        errors.settlementNotes = "Settlement notes must be 1000 characters or fewer";
      }
      if (next.enabledFeatures.length === 0) {
        errors.enabledFeatures = "Select at least one feature to enable";
      }
      return errors;
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextNormalized = normalizeDraft(draft);
      const nextErrors = validate(nextNormalized);

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        setStatus("error");
        setErrorMessage("Please resolve the highlighted fields");
        return;
      }

      setFieldErrors({});
      setStatus("saving");
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/countries/${countryId}/config`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            referenceFormat: nextNormalized.referenceFormat,
            settlementNotes: nextNormalized.settlementNotes || null,
            enabledFeatures: nextNormalized.enabledFeatures,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload && payload.error
              ? String((payload as { error: unknown }).error)
              : "Failed to update country configuration";
          throw new Error(message);
        }

        const data =
          payload && typeof payload === "object" && "data" in payload
            ? (payload as { data: any }).data
            : null;

        const updated: PersistedState = {
          referenceFormat:
            data?.reference_format?.trim().toUpperCase() || nextNormalized.referenceFormat,
          settlementNotes: data?.settlement_notes?.trim() ?? nextNormalized.settlementNotes,
          enabledFeatures: normalizeFeatures(
            data?.enabled_features ?? nextNormalized.enabledFeatures
          ),
          updatedAt: data?.updated_at ?? new Date().toISOString(),
        };

        setSaved(updated);
        setDraft({
          referenceFormat: updated.referenceFormat,
          settlementNotes: updated.settlementNotes,
          enabledFeatures: updated.enabledFeatures,
        });
        setStatus("success");
        setErrorMessage(null);
        success("Country settings updated");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update country configuration";
        setStatus("error");
        setErrorMessage(message);
        showError(message);
      }
    },
    [countryId, draft, showError, success, validate]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Reference format</h2>
        <p className="text-sm text-neutral-9">
          Control how deposit and member references are generated for statements, SMS, and exports.
        </p>
        <FormLayout>
          <FormField
            label="Reference format"
            inputId="country-reference-format"
            hint="Example: C3.D3.S3.G4.M3"
            error={fieldErrors.referenceFormat}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="referenceFormat"
                value={draft.referenceFormat}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    referenceFormat: event.target.value.toUpperCase(),
                  }))
                }
                className={CONTROL_CLASS}
                disabled={!canEdit || status === "saving"}
                placeholder="C3.D3.S3.G4.M3"
                autoComplete="off"
              />
            )}
          </FormField>
        </FormLayout>
      </WorkspaceSection>

      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Settlement notes</h2>
        <p className="text-sm text-neutral-9">
          Provide instructions for finance teams on how settlements should be reconciled and
          escalated.
        </p>
        <FormLayout>
          <FormField
            label="Settlement notes"
            inputId="country-settlement-notes"
            optionalLabel="Optional"
            hint="Shared in finance workspaces and reconciliation exports"
            error={fieldErrors.settlementNotes}
          >
            {({ id, describedBy }) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                name="settlementNotes"
                value={draft.settlementNotes}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, settlementNotes: event.target.value }))
                }
                className={cn(CONTROL_CLASS, "min-h-[140px] resize-y leading-relaxed")}
                disabled={!canEdit || status === "saving"}
                placeholder="Reconcile mobile money against core ledger daily."
              />
            )}
          </FormField>
        </FormLayout>
      </WorkspaceSection>

      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Feature toggles</h2>
        <p className="text-sm text-neutral-9">
          Enable or disable capabilities for every partner operating in this country.
        </p>
        <FormLayout>
          <FormField
            label="Enabled features"
            inputId="country-enabled-features"
            error={fieldErrors.enabledFeatures}
          >
            {({ id, describedBy }) => (
              <fieldset
                id={id}
                aria-describedby={describedBy}
                className="grid gap-2 sm:grid-cols-2"
              >
                {MULTICOUNTRY_FEATURES.map((option) => {
                  const checked = draft.enabledFeatures.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border border-neutral-6/60 bg-white/70 px-3 py-2 text-sm",
                        checked ? "border-kigali bg-kigali/10" : undefined
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-neutral-6"
                        checked={checked}
                        onChange={() => toggleFeature(option.value)}
                        disabled={!canEdit || status === "saving"}
                      />
                      <span className="text-neutral-12">{option.label}</span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </FormField>
        </FormLayout>
      </WorkspaceSection>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-kigali px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass transition hover:bg-[#ffe066] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canEdit || status === "saving" || (!dirty && status !== "error")}
        >
          {status === "saving" ? "Saving…" : dirty ? "Save changes" : "Up to date"}
        </button>
        {status === "error" && errorMessage ? (
          <span className="text-sm text-red-600">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}
