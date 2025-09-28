import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TemplatesTable } from '@/components/templates/TemplatesTable';
import { FlowsTable } from '@/components/templates/FlowsTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { listTemplates, listFlows } from '@/lib/data-provider';

export default async function TemplatesPage() {
  const [{ data: templates }, { data: flows }] = await Promise.all([
    listTemplates({ limit: 100 }),
    listFlows({ limit: 100 })
  ]);

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
        {templates.length ? (
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
        {flows.length ? (
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
