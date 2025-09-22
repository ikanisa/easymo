import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { SettingsTable } from '@/components/settings/SettingsTable';
import { TemplatesTable } from '@/components/templates/TemplatesTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { IntegrationsStatus } from '@/components/settings/IntegrationsStatus';
import { listSettingsPreview, listTemplates } from '@/lib/data-provider';

export default async function SettingsPage() {
  const [{ data: settingsPreview }, { data: templates }] = await Promise.all([
    listSettingsPreview({ limit: 100 }),
    listTemplates({ limit: 100 })
  ]);

  return (
    <div className="placeholder-grid">
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
        {settingsPreview.length ? (
          <SettingsTable data={settingsPreview} />
        ) : (
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
        {templates.length ? (
          <TemplatesTable data={templates} />
        ) : (
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
