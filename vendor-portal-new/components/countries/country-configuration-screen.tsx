"use client";

import { useMemo, useState } from "react";

import { AppShellHero } from "@/components/layout/app-shell";
import {
  WorkspaceAside,
  WorkspaceLayout,
  WorkspaceMain,
  WorkspaceSection,
} from "@/components/layout/workspace-layout";
import { GradientHeader } from "@/components/ui/gradient-header";
import { FormSummaryBanner, type FormSummaryStatus } from "@/components/ui/form";
import type { CountryRow, TelcoProvider } from "@/lib/types/multicountry";

import { CountryConfigForm, type CountryConfigFormSnapshot } from "./country-config-form";

interface CountryConfigurationScreenProps {
  country: CountryRow;
  config: {
    referenceFormat: string;
    settlementNotes?: string | null;
    enabledFeatures: string[];
    updatedAt?: string | null;
    languages?: string[];
  };
  telcos: Array<Pick<TelcoProvider, "id" | "name" | "ussd_pattern">>;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function CountryConfigurationScreen({
  country,
  config,
  telcos,
}: CountryConfigurationScreenProps) {
  const initialSnapshot: CountryConfigFormSnapshot = useMemo(
    () => ({
      draft: {
        referenceFormat: config.referenceFormat,
        settlementNotes: config.settlementNotes?.trim() ?? "",
        enabledFeatures: [...config.enabledFeatures],
      },
      saved: {
        referenceFormat: config.referenceFormat,
        settlementNotes: config.settlementNotes?.trim() ?? "",
        enabledFeatures: [...config.enabledFeatures],
        updatedAt: config.updatedAt ?? null,
      },
      dirty: false,
      status: "idle",
      errorMessage: null,
    }),
    [config.enabledFeatures, config.referenceFormat, config.settlementNotes, config.updatedAt]
  );

  const [snapshot, setSnapshot] = useState<CountryConfigFormSnapshot>(initialSnapshot);

  const preview = snapshot.dirty || snapshot.status === "saving" ? snapshot.draft : snapshot.saved;
  const lastSavedLabel = snapshot.saved.updatedAt
    ? formatter.format(new Date(snapshot.saved.updatedAt))
    : "Not saved yet";

  const summaryStatus: FormSummaryStatus =
    snapshot.status === "error" ? "error" : snapshot.status === "success" ? "success" : "info";

  const summaryTitle =
    snapshot.status === "error"
      ? "Unable to save"
      : snapshot.status === "success"
        ? "Settings synced"
        : snapshot.dirty
          ? "Unsaved changes"
          : "All changes saved";

  const summaryDescription =
    snapshot.status === "error"
      ? (snapshot.errorMessage ?? "Fix the highlighted fields and try again.")
      : snapshot.status === "success"
        ? "Updates will propagate to reconciliation workflows and statement ingestion."
        : snapshot.dirty
          ? "Review the changes in the form and save when ready."
          : `Last updated ${lastSavedLabel}.`;

  return (
    <>
      <AppShellHero>
        <GradientHeader
          title={`${country.name} configuration`}
          subtitle={`Manage settlement guidance, reference formats, and feature toggles for ${country.name}.`}
          badge={
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
              ISO {country.iso3}
            </span>
          }
        />
      </AppShellHero>

      <WorkspaceLayout>
        <WorkspaceMain>
          <WorkspaceSection className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-12">Country profile</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">Name</dt>
                <dd className="text-sm text-neutral-12">{country.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">ISO codes</dt>
                <dd className="text-sm text-neutral-12">
                  {country.iso2} · {country.iso3}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">Currency</dt>
                <dd className="text-sm text-neutral-12">{country.currency_code}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">Timezone</dt>
                <dd className="text-sm text-neutral-12">{country.timezone}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">
                  Supported languages
                </dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {(config.languages ?? []).map((language) => (
                    <span
                      key={language}
                      className="rounded-full bg-neutral-3/30 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-11"
                    >
                      {language}
                    </span>
                  ))}
                  {(!config.languages || config.languages.length === 0) && (
                    <span className="text-sm text-neutral-9">No languages configured</span>
                  )}
                </dd>
              </div>
            </dl>
          </WorkspaceSection>

          <CountryConfigForm
            countryId={country.id}
            initialReferenceFormat={config.referenceFormat}
            initialSettlementNotes={config.settlementNotes ?? ""}
            initialFeatures={config.enabledFeatures}
            initialUpdatedAt={config.updatedAt ?? null}
            onSnapshotChange={setSnapshot}
          />
        </WorkspaceMain>

        <WorkspaceAside>
          <FormSummaryBanner
            status={summaryStatus}
            title={summaryTitle}
            description={summaryDescription}
          />

          <div className="space-y-4 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Reference format</h3>
            <p className="font-mono text-sm text-neutral-12">{preview.referenceFormat || "—"}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Enabled features</h3>
            {preview.enabledFeatures.length ? (
              <ul className="space-y-2">
                {preview.enabledFeatures.map((feature) => (
                  <li key={feature} className="text-sm text-neutral-12">
                    • {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-9">No features enabled</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Telco providers</h3>
            {telcos.length ? (
              <ul className="space-y-2">
                {telcos.map((telco) => (
                  <li key={telco.id} className="text-sm text-neutral-12">
                    <div className="font-medium text-neutral-12">{telco.name}</div>
                    <div className="text-xs text-neutral-9">USSD: {telco.ussd_pattern}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-9">No telco providers configured</p>
            )}
          </div>
        </WorkspaceAside>
      </WorkspaceLayout>
    </>
  );
}
