export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { CampaignsClient } from "./CampaignsClient";
import {
  campaignsQueryKeys,
  type CampaignsQueryParams,
  fetchCampaigns,
} from "@/lib/queries/campaigns";
import {
  fetchTemplates,
  templatesQueryKeys,
  type TemplatesQueryParams,
} from "@/lib/queries/templates";

const DEFAULT_CAMPAIGN_PARAMS: CampaignsQueryParams = { limit: 100 };
const DEFAULT_TEMPLATE_PARAMS: TemplatesQueryParams = { limit: 20 };

export default async function CampaignsPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: campaignsQueryKeys.list(DEFAULT_CAMPAIGN_PARAMS),
      queryFn: () => fetchCampaigns(DEFAULT_CAMPAIGN_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: templatesQueryKeys.list(DEFAULT_TEMPLATE_PARAMS),
      queryFn: () => fetchTemplates(DEFAULT_TEMPLATE_PARAMS),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <CampaignsClient
        initialCampaignParams={DEFAULT_CAMPAIGN_PARAMS}
        initialTemplateParams={DEFAULT_TEMPLATE_PARAMS}
      />
    </HydrationBoundary>
  );
}
