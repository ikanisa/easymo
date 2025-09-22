import { PageHeader } from '@/components/layout/PageHeader';
import { CampaignsTable } from '@/components/campaigns/CampaignsTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CampaignWizardMock } from '@/components/campaigns/CampaignWizardMock';
import { CampaignControls } from '@/components/campaigns/CampaignControls';
import { listCampaigns, listTemplates } from '@/lib/data-provider';

export default async function CampaignsPage() {
  const [{ data }, { data: templates }] = await Promise.all([listCampaigns(), listTemplates({ limit: 20 })]);

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Campaigns"
        description="Create, monitor, and control WhatsApp campaigns with template management and dispatcher bridges. Wizard and dispatcher actions will arrive in later milestones."
      />
      <SectionCard
        title="Campaigns"
        description="Use filters to review campaign status. Start/Pause/Stop controls will be enabled after the dispatcher bridge is wired up."
      >
        {data.length ? (
          <CampaignsTable data={data} />
        ) : (
          <EmptyState
            title="No campaigns"
            description="Connect Supabase to view campaign drafts and runs."
          />
        )}
      </SectionCard>
      <SectionCard
        title="Campaign wizard"
        description="Step-by-step flow for selecting templates, uploading CSVs, and configuring voucher issuance."
      >
        <CampaignWizardMock templates={templates} />
      </SectionCard>
      <SectionCard
        title="Dispatcher controls"
        description="Call the dispatcher mock endpoints. Real bridges will control the Supabase Edge Function later."
      >
        {data.length ? (
          <CampaignControls campaigns={data} />
        ) : (
          <EmptyState
            title="Controls unavailable"
            description="Create a campaign draft to unlock dispatcher actions."
          />
        )}
      </SectionCard>
    </div>
  );
}
