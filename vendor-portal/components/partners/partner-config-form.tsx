"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceSection } from "@/components/layout/workspace-layout";
import { FormField, FormLayout } from "@/components/ui/form";
import { useToast } from "@/providers/toast-provider";
import { cn } from "@/lib/utils";
import { MULTICOUNTRY_FEATURES } from "@/lib/multicountry/constants";

type DraftState = {
  merchantCode: string;
  referencePrefix: string;
  enabledFeatures: string[];
  languageInput: string;
  contactPhone: string;
  contactEmail: string;
  contactHours: string;
};

type NormalizedState = {
  merchantCode: string | null;
  referencePrefix: string | null;
  enabledFeatures: string[];
  languagePack: string[];
  contact: {
    phone: string | null;
    email: string | null;
    hours: string | null;
  } | null;
};

type PersistedState = NormalizedState & { updatedAt: string | null };

type Status = "idle" | "saving" | "success" | "error";

export interface PartnerConfigFormSnapshot {
  draft: NormalizedState;
  saved: PersistedState;
  dirty: boolean;
  status: Status;
  errorMessage: string | null;
}

export interface PartnerConfigFormProps {
  partnerId: string;
  initialMerchantCode?: string | null;
  initialReferencePrefix?: string | null;
  initialFeatures?: string[] | null;
  initialLanguagePack?: string[] | null;
  initialContact?: { phone?: string | null; email?: string | null; hours?: string | null } | null;
  initialUpdatedAt?: string | null;
  availableLanguages?: string[];
  onSnapshotChange?: (snapshot: PartnerConfigFormSnapshot) => void;
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

function parseLanguages(input: string, fallback?: string[] | null): string[] {
  if (!input.trim()) {
    return normalizeFeatures(fallback ?? []);
  }
  const entries = input
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalizeFeatures(entries);
}

function normalizeDraft(draft: DraftState, fallbackLanguages?: string[] | null): NormalizedState {
  const languagePack = parseLanguages(draft.languageInput, fallbackLanguages);
  const merchantCode = draft.merchantCode.trim();
  const referencePrefix = draft.referencePrefix.trim().toUpperCase();
  const contactPhone = draft.contactPhone.trim();
  const contactEmail = draft.contactEmail.trim();
  const contactHours = draft.contactHours.trim();

  const contactExists = contactPhone || contactEmail || contactHours;

  return {
    merchantCode: merchantCode ? merchantCode.toUpperCase() : null,
    referencePrefix: referencePrefix ? referencePrefix : null,
    enabledFeatures: normalizeFeatures(draft.enabledFeatures),
    languagePack,
    contact: contactExists
      ? {
          phone: contactPhone || null,
          email: contactEmail || null,
          hours: contactHours || null,
        }
      : null,
  };
}

function statesEqual(a: NormalizedState, b: NormalizedState) {
  if (a.merchantCode !== b.merchantCode) return false;
  if (a.referencePrefix !== b.referencePrefix) return false;
  if (a.enabledFeatures.length !== b.enabledFeatures.length) return false;
  if (!a.enabledFeatures.every((value, index) => value === b.enabledFeatures[index])) return false;
  if (a.languagePack.length !== b.languagePack.length) return false;
  if (!a.languagePack.every((value, index) => value === b.languagePack[index])) return false;

  const contactA = a.contact ?? { phone: null, email: null, hours: null };
  const contactB = b.contact ?? { phone: null, email: null, hours: null };

  return (
    contactA.phone === contactB.phone &&
    contactA.email === contactB.email &&
    contactA.hours === contactB.hours
  );
}

export function PartnerConfigForm({
  partnerId,
  initialMerchantCode,
  initialReferencePrefix,
  initialFeatures,
  initialLanguagePack,
  initialContact,
  initialUpdatedAt,
  availableLanguages = [],
  onSnapshotChange,
  canEdit = true,
}: PartnerConfigFormProps) {
  const normalizedInitial: PersistedState = {
    merchantCode: initialMerchantCode?.trim() ? initialMerchantCode.trim().toUpperCase() : null,
    referencePrefix: initialReferencePrefix?.trim()
      ? initialReferencePrefix.trim().toUpperCase()
      : null,
    enabledFeatures: normalizeFeatures(initialFeatures ?? undefined),
    languagePack: normalizeFeatures(initialLanguagePack ?? undefined),
    contact: initialContact
      ? {
          phone: initialContact.phone?.trim() || null,
          email: initialContact.email?.trim() || null,
          hours: initialContact.hours?.trim() || null,
        }
      : null,
    updatedAt: initialUpdatedAt ?? null,
  };

  const [draft, setDraft] = useState<DraftState>({
    merchantCode: normalizedInitial.merchantCode ?? "",
    referencePrefix: normalizedInitial.referencePrefix ?? "",
    enabledFeatures: normalizedInitial.enabledFeatures,
    languageInput:
      normalizedInitial.languagePack.length > 0 ? normalizedInitial.languagePack.join(", ") : "",
    contactPhone: normalizedInitial.contact?.phone ?? "",
    contactEmail: normalizedInitial.contact?.email ?? "",
    contactHours: normalizedInitial.contact?.hours ?? "",
  });
  const [saved, setSaved] = useState<PersistedState>(normalizedInitial);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DraftState, string>>>({});

  const { success, error: showError } = useToast();

  const normalizedDraft = useMemo(
    () =>
      normalizeDraft(
        draft,
        normalizedInitial.languagePack.length ? normalizedInitial.languagePack : availableLanguages
      ),
    [availableLanguages, draft, normalizedInitial.languagePack]
  );

  const savedComparable = useMemo<NormalizedState>(
    () => ({
      merchantCode: saved.merchantCode,
      referencePrefix: saved.referencePrefix,
      enabledFeatures: saved.enabledFeatures,
      languagePack: saved.languagePack,
      contact: saved.contact,
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
      if (next.merchantCode && !/^[A-Z0-9]{3,32}$/.test(next.merchantCode)) {
        errors.merchantCode = "Merchant code should be 3-32 letters or digits";
      }
      if (next.referencePrefix && !/^[A-Z0-9-]{2,12}$/.test(next.referencePrefix)) {
        errors.referencePrefix = "Use 2-12 uppercase characters for the reference prefix";
      }
      if (next.languagePack.length === 0) {
        errors.languageInput = "Add at least one language";
      }
      const email = next.contact?.email ?? "";
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.contactEmail = "Enter a valid email address";
      }
      const phone = next.contact?.phone ?? "";
      if (phone && phone.replace(/[^0-9]/g, "").length < 8) {
        errors.contactPhone = "Phone number should include at least 8 digits";
      }
      return errors;
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextNormalized = normalizeDraft(draft, normalizedInitial.languagePack);
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
        const response = await fetch(`/api/partners/${partnerId}/config`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            merchantCode: nextNormalized.merchantCode,
            referencePrefix: nextNormalized.referencePrefix,
            enabledFeatures: nextNormalized.enabledFeatures,
            languagePack: nextNormalized.languagePack,
            contact: nextNormalized.contact,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload && payload.error
              ? String((payload as { error: unknown }).error)
              : "Failed to update partner configuration";
          throw new Error(message);
        }

        const data =
          payload && typeof payload === "object" && "data" in payload
            ? (payload as { data: any }).data
            : null;

        const updated: PersistedState = {
          merchantCode: data?.merchant_code?.trim()
            ? data.merchant_code.trim().toUpperCase()
            : nextNormalized.merchantCode,
          referencePrefix: data?.reference_prefix?.trim()
            ? data.reference_prefix.trim().toUpperCase()
            : nextNormalized.referencePrefix,
          enabledFeatures: normalizeFeatures(
            data?.enabled_features ?? nextNormalized.enabledFeatures
          ),
          languagePack: normalizeFeatures(data?.language_pack ?? nextNormalized.languagePack),
          contact: data?.contact
            ? {
                phone: data.contact.phone?.trim() || null,
                email: data.contact.email?.trim() || null,
                hours: data.contact.hours?.trim() || null,
              }
            : nextNormalized.contact,
          updatedAt: data?.updated_at ?? new Date().toISOString(),
        };

        setSaved(updated);
        setDraft({
          merchantCode: updated.merchantCode ?? "",
          referencePrefix: updated.referencePrefix ?? "",
          enabledFeatures: updated.enabledFeatures,
          languageInput: updated.languagePack.length ? updated.languagePack.join(", ") : "",
          contactPhone: updated.contact?.phone ?? "",
          contactEmail: updated.contact?.email ?? "",
          contactHours: updated.contact?.hours ?? "",
        });
        setStatus("success");
        setErrorMessage(null);
        success("Partner settings updated");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update partner configuration";
        setStatus("error");
        setErrorMessage(message);
        showError(message);
      }
    },
    [draft, normalizedInitial.languagePack, partnerId, showError, success, validate]
  );

  const availableLanguageHint = availableLanguages.length
    ? `Suggested locales: ${availableLanguages.join(", ")}`
    : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Merchant profile</h2>
        <p className="text-sm text-neutral-9">
          Assign merchant identifiers and reference prefixes for partner statements.
        </p>
        <FormLayout variant="double" className="gap-6">
          <FormField
            label="Merchant code"
            inputId="partner-merchant-code"
            optionalLabel="Optional"
            hint="Configured with mobile money providers"
            error={fieldErrors.merchantCode}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="merchantCode"
                value={draft.merchantCode}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, merchantCode: event.target.value }))
                }
                className={CONTROL_CLASS}
                disabled={!canEdit || status === "saving"}
                placeholder="e.g. 123456"
              />
            )}
          </FormField>
          <FormField
            label="Reference prefix"
            inputId="partner-reference-prefix"
            optionalLabel="Optional"
            hint="Used for member codes and statement reconciliation"
            error={fieldErrors.referencePrefix}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="referencePrefix"
                value={draft.referencePrefix}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    referencePrefix: event.target.value.toUpperCase(),
                  }))
                }
                className={CONTROL_CLASS}
                disabled={!canEdit || status === "saving"}
                placeholder="e.g. AMA"
              />
            )}
          </FormField>
        </FormLayout>
      </WorkspaceSection>

      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Language pack</h2>
        <p className="text-sm text-neutral-9">
          Control which locales are enabled for customer communications and receipts.
        </p>
        <FormLayout>
          <FormField
            label="Supported locales"
            inputId="partner-language-pack"
            hint={availableLanguageHint ?? "Separate entries with commas or new lines"}
            error={fieldErrors.languageInput}
          >
            {({ id, describedBy }) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                name="languagePack"
                value={draft.languageInput}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, languageInput: event.target.value }))
                }
                className={cn(CONTROL_CLASS, "min-h-[120px] resize-y leading-relaxed")}
                disabled={!canEdit || status === "saving"}
                placeholder="rw-RW, en-RW"
              />
            )}
          </FormField>
        </FormLayout>
      </WorkspaceSection>

      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Feature toggles</h2>
        <p className="text-sm text-neutral-9">
          Override country defaults to enable partner-specific capabilities.
        </p>
        <FormLayout>
          <FormField label="Enabled features" inputId="partner-enabled-features">
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

      <WorkspaceSection className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-12">Support contacts</h2>
        <p className="text-sm text-neutral-9">
          Surface helpline details inside staff tooling and automated notifications.
        </p>
        <FormLayout variant="double" className="gap-6">
          <FormField
            label="Support phone"
            inputId="partner-contact-phone"
            optionalLabel="Optional"
            hint="Displayed on receipts and reminder SMS"
            error={fieldErrors.contactPhone}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="contactPhone"
                value={draft.contactPhone}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, contactPhone: event.target.value }))
                }
                className={CONTROL_CLASS}
                disabled={!canEdit || status === "saving"}
                placeholder="e.g. +250788000000"
              />
            )}
          </FormField>
          <FormField
            label="Support email"
            inputId="partner-contact-email"
            optionalLabel="Optional"
            hint="Used for escalation workflows"
            error={fieldErrors.contactEmail}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="contactEmail"
                value={draft.contactEmail}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, contactEmail: event.target.value }))
                }
                className={CONTROL_CLASS}
                disabled={!canEdit || status === "saving"}
                placeholder="support@example.com"
              />
            )}
          </FormField>
          <FormField
            label="Operating hours"
            inputId="partner-contact-hours"
            optionalLabel="Optional"
            hint="Shown to staff agents"
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="contactHours"
                value={draft.contactHours}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, contactHours: event.target.value }))
                }
                className={CONTROL_CLASS}
                disabled={!canEdit || status === "saving"}
                placeholder="Mon-Fri 08:00-17:00"
              />
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
