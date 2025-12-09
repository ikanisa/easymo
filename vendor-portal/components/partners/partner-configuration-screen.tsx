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
import type { TelcoProvider } from "@/lib/types/multicountry";

import { PartnerConfigForm, type PartnerConfigFormSnapshot } from "./partner-config-form";

interface PartnerInfo {
  id: string;
  name: string;
  type: string;
  country?: { name: string; iso2: string } | null;
  districtCode?: string | null;
}

interface PartnerConfigurationScreenProps {
  partner: PartnerInfo;
  config: {
    merchantCode?: string | null;
    referencePrefix?: string | null;
    enabledFeatures: string[];
    languagePack: string[];
    contact?: { phone?: string | null; email?: string | null; hours?: string | null } | null;
    updatedAt?: string | null;
  };
  telcos: Array<Pick<TelcoProvider, "id" | "name" | "ussd_pattern">>;
  availableLanguages: string[];
}

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PartnerConfigurationScreen({
  partner,
  config,
  telcos,
  availableLanguages,
}: PartnerConfigurationScreenProps) {
  const initialSnapshot: PartnerConfigFormSnapshot = useMemo(
    () => ({
      draft: {
        merchantCode: config.merchantCode?.toUpperCase() ?? null,
        referencePrefix: config.referencePrefix?.toUpperCase() ?? null,
        enabledFeatures: [...config.enabledFeatures],
        languagePack: [...config.languagePack],
        contact: config.contact
          ? {
              phone: config.contact.phone?.trim() || null,
              email: config.contact.email?.trim() || null,
              hours: config.contact.hours?.trim() || null,
            }
          : null,
      },
      saved: {
        merchantCode: config.merchantCode?.toUpperCase() ?? null,
        referencePrefix: config.referencePrefix?.toUpperCase() ?? null,
        enabledFeatures: [...config.enabledFeatures],
        languagePack: [...config.languagePack],
        contact: config.contact
          ? {
              phone: config.contact.phone?.trim() || null,
              email: config.contact.email?.trim() || null,
              hours: config.contact.hours?.trim() || null,
            }
          : null,
        updatedAt: config.updatedAt ?? null,
      },
      dirty: false,
      status: "idle",
      errorMessage: null,
    }),
    [
      config.contact,
      config.enabledFeatures,
      config.languagePack,
      config.merchantCode,
      config.referencePrefix,
      config.updatedAt,
    ]
  );

  const [snapshot, setSnapshot] = useState<PartnerConfigFormSnapshot>(initialSnapshot);

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
        ? "Overrides update partner portals, receipts, and automated communications."
        : snapshot.dirty
          ? "Review the updated merchant details and save when ready."
          : `Last updated ${lastSavedLabel}.`;

  const contact = preview.contact ?? { phone: null, email: null, hours: null };

  return (
    <>
      <AppShellHero>
        <GradientHeader
          title={`${partner.name} settings`}
          subtitle={`Configure merchant identifiers, feature overrides, and contact details for ${partner.name}.`}
          badge={
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
              {partner.type}
            </span>
          }
        />
      </AppShellHero>

      <WorkspaceLayout>
        <WorkspaceMain>
          <WorkspaceSection className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-12">Partner profile</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">Organization</dt>
                <dd className="text-sm text-neutral-12">{partner.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">Country</dt>
                <dd className="text-sm text-neutral-12">
                  {partner.country ? `${partner.country.name} (${partner.country.iso2})` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-7">District</dt>
                <dd className="text-sm text-neutral-12">{partner.districtCode ?? "—"}</dd>
              </div>
            </dl>
          </WorkspaceSection>

          <PartnerConfigForm
            partnerId={partner.id}
            initialMerchantCode={config.merchantCode ?? ""}
            initialReferencePrefix={config.referencePrefix ?? ""}
            initialFeatures={config.enabledFeatures}
            initialLanguagePack={config.languagePack}
            initialContact={config.contact}
            initialUpdatedAt={config.updatedAt ?? null}
            availableLanguages={availableLanguages}
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
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Merchant code</h3>
            <p className="font-mono text-sm text-neutral-12">{preview.merchantCode ?? "—"}</p>
          </div>

          <div className="space-y-4 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Reference prefix</h3>
            <p className="font-mono text-sm text-neutral-12">{preview.referencePrefix ?? "—"}</p>
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
              <p className="text-sm text-neutral-9">Inherits country defaults</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Languages</h3>
            {preview.languagePack.length ? (
              <ul className="space-y-2">
                {preview.languagePack.map((language) => (
                  <li key={language} className="text-sm text-neutral-12">
                    • {language}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-9">No overrides — country defaults apply</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Support contact</h3>
            <ul className="space-y-1 text-sm text-neutral-12">
              <li>Phone: {contact.phone ?? "—"}</li>
              <li>Email: {contact.email ?? "—"}</li>
              <li>Hours: {contact.hours ?? "—"}</li>
            </ul>
          </div>

          <div className="space-y-3 rounded-2xl border border-neutral-6/60 bg-white/70 p-4">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-7">Available telcos</h3>
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
              <p className="text-sm text-neutral-9">No telcos assigned</p>
            )}
          </div>
        </WorkspaceAside>
      </WorkspaceLayout>
    </>
  );
}
