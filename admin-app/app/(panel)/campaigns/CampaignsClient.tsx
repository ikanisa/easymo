'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CampaignsTable } from '@/components/campaigns/CampaignsTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CampaignWizardMock } from '@/components/campaigns/CampaignWizardMock';
import { CampaignControls } from '@/components/campaigns/CampaignControls';
import { LoadingState } from '@/components/ui/LoadingState';
import { useCampaignsQuery, type CampaignsQueryParams } from '@/lib/queries/campaigns';
import { useTemplatesQuery, type TemplatesQueryParams } from '@/lib/queries/templates';

interface CampaignsClientProps {
  initialCampaignParams?: CampaignsQueryParams;
  initialTemplateParams?: TemplatesQueryParams;
}

export function CampaignsClient({
  initialCampaignParams = { limit: 100 },
  initialTemplateParams = { limit: 20 }
}: CampaignsClientProps) {
  const [campaignParams] = useState<CampaignsQueryParams>(initialCampaignParams);
  const [templateParams] = useState<TemplatesQueryParams>(initialTemplateParams);

  const campaignsQuery = useCampaignsQuery(campaignParams);
  const templatesQuery = useTemplatesQuery(templateParams);

  const campaigns = campaignsQuery.data?.data ?? [];
  const templates = templatesQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Campaigns"
        description="Create, monitor, and control WhatsApp campaigns with template management and dispatcher bridges. Wizard and dispatcher actions will arrive in later milestones."
      />
      <SectionCard
        title="Campaigns"
        description="Use filters to review campaign status. Start/Pause/Stop controls will be enabled after the dispatcher bridge is wired up."
      >
        {campaignsQuery.isLoading ? (
          <LoadingState title="Loading campaigns" description="Fetching campaign roster." />
        ) : campaigns.length ? (
          <CampaignsTable data={campaigns} />
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
        {templatesQuery.isLoading ? (
          <LoadingState title="Loading templates" description="Fetching approved templates." />
        ) : (
          <CampaignWizardMock templates={templates} />
        )}
      </SectionCard>
      <SectionCard
        title="Dispatcher controls"
        description="Call the dispatcher mock endpoints. Real bridges will control the Supabase Edge Function later."
      >
        {campaignsQuery.isLoading ? (
          <LoadingState title="Loading dispatcher data" description="Preparing campaign controls." />
        ) : campaigns.length ? (
          <CampaignControls campaigns={campaigns} />
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
