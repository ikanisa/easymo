"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { SettingsTable } from "@/components/settings/SettingsTable";
import { TemplatesTable } from "@/components/templates/TemplatesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IntegrationsStatus } from "@/components/settings/IntegrationsStatus";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type SettingsPreviewParams,
  useSettingsPreviewQuery,
} from "@/lib/queries/settings";
import {
  type TemplatesQueryParams,
  useTemplatesQuery,
} from "@/lib/queries/templates";

interface SettingsClientProps {
  initialPreviewParams?: SettingsPreviewParams;
  initialTemplateParams?: TemplatesQueryParams;
}

export function SettingsClient({
  initialPreviewParams = { limit: 100 },
  initialTemplateParams = { limit: 100 },
}: SettingsClientProps) {
  const [previewParams] = useState(initialPreviewParams);
  const [templateParams, setTemplateParams] = useState(initialTemplateParams);

  const previewQuery = useSettingsPreviewQuery(previewParams);
  const templatesQuery = useTemplatesQuery(templateParams);

  const preview = previewQuery.data?.data ?? [];
  const templates = templatesQuery.data?.data ?? [];
  const templatesHasMore = templatesQuery.data?.hasMore;
  const templatesLoadingMore = templatesQuery.isFetching && !templatesQuery.isLoading;

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
        title="Current values"
        description="Snapshot of settings from the data provider."
      >
        {previewQuery.isLoading
          ? (
            <LoadingState
              title="Loading settings"
              description="Reading saved configuration."
            />
          )
          : preview.length
          ? <SettingsTable data={preview} />
          : (
            <EmptyState
              title="Settings preview unavailable"
              description="Connect to Supabase to view saved settings."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Template library"
        description="Manage template metadata and variables without leaving the settings screen."
      >
        {templatesQuery.isLoading
          ? (
            <LoadingState
              title="Loading templates"
              description="Fetching template metadata."
            />
          )
          : templates.length
          ? (
            <TemplatesTable
              data={templates}
              statusFilter={templateParams.status ?? ""}
              hasMore={templatesHasMore}
              loadingMore={templatesLoadingMore}
              onStatusChange={(value) =>
                setTemplateParams((prev) => ({
                  ...prev,
                  status: value || undefined,
                  limit: initialTemplateParams.limit ?? 100,
                }))}
              onLoadMore={() =>
                setTemplateParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? initialTemplateParams.limit ?? 100) + 50,
                }))}
            />
          )
          : (
            <EmptyState
              title="Templates unavailable"
              description="Connect to Supabase to view template configuration."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Integrations status"
        description="Voucher preview, media send, and dispatcher probes refresh every 60 seconds."
      >
        <IntegrationsStatus />
      </SectionCard>
    </div>
  );
}
