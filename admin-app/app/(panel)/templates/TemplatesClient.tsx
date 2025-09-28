'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TemplatesTable } from '@/components/templates/TemplatesTable';
import { FlowsTable } from '@/components/templates/FlowsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useTemplatesQuery, type TemplatesQueryParams } from '@/lib/queries/templates';
import { useFlowsQuery, type FlowsQueryParams } from '@/lib/queries/flows';

interface TemplatesClientProps {
  initialTemplateParams?: TemplatesQueryParams;
  initialFlowParams?: FlowsQueryParams;
}

export function TemplatesClient({
  initialTemplateParams = { limit: 100 },
  initialFlowParams = { limit: 100 }
}: TemplatesClientProps) {
  const [templateParams] = useState(initialTemplateParams);
  const [flowParams] = useState(initialFlowParams);

  const templatesQuery = useTemplatesQuery(templateParams);
  const flowsQuery = useFlowsQuery(flowParams);

  const templates = templatesQuery.data?.data ?? [];
  const flows = flowsQuery.data?.data ?? [];

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
        {templatesQuery.isLoading ? (
          <LoadingState title="Loading templates" description="Fetching template metadata." />
        ) : templates.length ? (
          <TemplatesTable data={templates} />
        ) : (
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
        {flowsQuery.isLoading ? (
          <LoadingState title="Loading flows" description="Fetching flow metadata." />
        ) : flows.length ? (
          <FlowsTable data={flows} />
        ) : (
          <EmptyState
            title="No flows"
            description="Flow metadata will appear once Supabase data is connected."
          />
        )}
      </SectionCard>
    </div>
  );
}
