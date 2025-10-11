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
import { type TemplatesQueryParams } from "@/lib/queries/templates";
import { SettingsPreviewSection } from "@/components/settings/SettingsPreviewSection";
import { TemplatesSection } from "@/components/settings/TemplatesSection";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import { useTemplatesListing } from "@/lib/templates/useTemplatesListing";

interface SettingsClientProps {
  initialPreviewParams?: SettingsPreviewParams;
  initialTemplateParams?: TemplatesQueryParams;
}

export function SettingsClient({
  initialPreviewParams = { limit: 100 },
  initialTemplateParams = { limit: 100 },
}: SettingsClientProps) {
  const [previewParams] = useState(initialPreviewParams);
  const previewQuery = useSettingsPreviewQuery(previewParams);
  const templatesListing = useTemplatesListing({
    initialParams: initialTemplateParams,
    loadStep: 50,
  });

  const preview = previewQuery.data?.data ?? [];
  const templates = templatesListing.templates;

  return (
    <div className="admin-page">
      <PageHeader
        title="Settings"
        description="Configure quiet hours, throttles, opt-outs, templates, and integrations for outbound messaging."
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

      <TemplatesSection
        isLoading={templatesListing.query.isLoading}
        templates={templates}
        statusFilter={templatesListing.statusFilter}
        hasMore={templatesListing.hasMore}
        loadingMore={templatesListing.loadingMore}
        onStatusChange={templatesListing.handleStatusChange}
        onLoadMore={templatesListing.handleLoadMore}
      />

      <IntegrationsSection />
    </div>
  );
}
