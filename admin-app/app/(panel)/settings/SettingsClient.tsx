"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { AlertPreferences } from "@/components/settings/AlertPreferences";
import {
  type SettingsPreviewParams,
  useSettingsPreviewQuery,
} from "@/lib/queries/settings";
import { SettingsPreviewSection } from "@/components/settings/SettingsPreviewSection";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";

interface SettingsClientProps {
  initialPreviewParams?: SettingsPreviewParams;
}

export function SettingsClient({
  initialPreviewParams = { limit: 100 },
}: SettingsClientProps) {
  const [previewParams] = useState(initialPreviewParams);
  const previewQuery = useSettingsPreviewQuery(previewParams);

  const preview = previewQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Settings"
        description="Configure quiet hours, throttles, opt-outs, and integrations for outbound messaging."
      />

      <SectionCard
        title="Platform settings"
        description="Update quiet hours, throttles, and opt-out lists. Changes persist when Supabase credentials are present."
      >
        <SettingsForm />
      </SectionCard>

      <SectionCard
        title="Alert preferences"
        description="Control which operational alerts notify the admin team across channels."
      >
        <AlertPreferences />
      </SectionCard>

      <SettingsPreviewSection
        isLoading={previewQuery.isLoading}
        data={preview}
      />

      <IntegrationsSection />
    </div>
  );
}
