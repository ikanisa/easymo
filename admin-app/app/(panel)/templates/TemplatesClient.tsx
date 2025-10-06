"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { TemplatesTable } from "@/components/templates/TemplatesTable";
import { FlowsTable } from "@/components/templates/FlowsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type TemplatesQueryParams,
  useTemplatesQuery,
} from "@/lib/queries/templates";
import { type FlowsQueryParams, useFlowsQuery } from "@/lib/queries/flows";

interface TemplatesClientProps {
  initialTemplateParams?: TemplatesQueryParams;
  initialFlowParams?: FlowsQueryParams;
}

export function TemplatesClient({
  initialTemplateParams = { limit: 100 },
  initialFlowParams = { limit: 100 },
}: TemplatesClientProps) {
  const [templateParams, setTemplateParams] = useState(initialTemplateParams);
  const [flowParams, setFlowParams] = useState(initialFlowParams);

  const templatesQuery = useTemplatesQuery(templateParams);
  const flowsQuery = useFlowsQuery(flowParams);

  const templates = templatesQuery.data?.data ?? [];
  const flows = flowsQuery.data?.data ?? [];
  const templatesHasMore = templatesQuery.data?.hasMore;
  const templatesLoadingMore = templatesQuery.isFetching && !templatesQuery.isLoading;
  const flowsHasMore = flowsQuery.data?.hasMore;
  const flowsLoadingMore = flowsQuery.isFetching && !flowsQuery.isLoading;

  return (
    <div className="admin-page">
      <PageHeader
        title="Templates & Flows"
        description="Catalog of WhatsApp templates and flow metadata with health checks and deep links to Meta."
      />

      <SectionCard
        title="Templates catalog"
        description="Send tests, duplicate, and manage template variables once write APIs are available."
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
              title="No templates"
              description="Connect Supabase or load fixtures to review template metadata."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Flows catalog"
        description="Publish, toggle test mode, and ping endpoints from this directory."
      >
        {flowsQuery.isLoading
          ? (
            <LoadingState
              title="Loading flows"
              description="Fetching flow metadata."
            />
          )
          : flows.length
          ? (
            <FlowsTable
              data={flows}
              statusFilter={flowParams.status ?? ""}
              hasMore={flowsHasMore}
              loadingMore={flowsLoadingMore}
              onStatusChange={(value) =>
                setFlowParams((prev) => ({
                  ...prev,
                  status: value || undefined,
                  limit: initialFlowParams.limit ?? 100,
                  offset: 0,
                }))}
              onLoadMore={() =>
                setFlowParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? initialFlowParams.limit ?? 100) + 25,
                }))}
            />
          )
          : (
            <EmptyState
              title="No flows"
              description="Flow metadata will appear once Supabase data is connected."
            />
          )}
      </SectionCard>
    </div>
  );
}
