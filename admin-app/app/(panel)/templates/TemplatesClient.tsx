"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { TemplatesTable } from "@/components/templates/TemplatesTable";
import { FlowsTable } from "@/components/templates/FlowsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { type TemplatesQueryParams } from "@/lib/queries/templates";
import { type FlowsQueryParams } from "@/lib/queries/flows";
import { useTemplatesListing } from "@/lib/templates/useTemplatesListing";
import { useFlowsListing } from "@/lib/flows/useFlowsListing";

interface TemplatesClientProps {
  initialTemplateParams?: TemplatesQueryParams;
  initialFlowParams?: FlowsQueryParams;
}

export function TemplatesClient({
  initialTemplateParams = { limit: 100 },
  initialFlowParams = { limit: 100 },
}: TemplatesClientProps) {
  const templatesListing = useTemplatesListing({
    initialParams: initialTemplateParams,
    loadStep: 50,
  });

  const flowsListing = useFlowsListing({
    initialParams: initialFlowParams,
    loadStep: 25,
  });

  const templates = templatesListing.templates;
  const flows = flowsListing.flows;
  const templatesHasMore = templatesListing.hasMore;
  const templatesLoadingMore = templatesListing.loadingMore;
  const flowsHasMore = flowsListing.hasMore;
  const flowsLoadingMore = flowsListing.loadingMore;

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
        {templatesListing.query.isLoading
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
              statusFilter={templatesListing.statusFilter as any}
              hasMore={templatesHasMore}
              loadingMore={templatesLoadingMore}
              onStatusChange={(value) => templatesListing.handleStatusChange(value as any)}
              onLoadMore={templatesListing.handleLoadMore}
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
        {flowsListing.query.isLoading
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
              statusFilter={flowsListing.statusFilter as any}
              hasMore={flowsHasMore}
              loadingMore={flowsLoadingMore}
              onStatusChange={(value) => flowsListing.handleStatusChange(value as any)}
              onLoadMore={flowsListing.handleLoadMore}
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
