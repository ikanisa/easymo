export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchMarketplaceAgentSessions,
  marketplaceAgentSessionsQueryKeys,
  type MarketplaceAgentSessionsQueryParams,
} from "@/lib/queries/marketplaceAgentSessions";

import { PharmaciesClient } from "./PharmaciesClient";

const DEFAULT_PARAMS: MarketplaceAgentSessionsQueryParams = {
  agentType: "pharmacy",
  flowType: "nearby_pharmacies",
  limit: 25,
};

export default async function PharmaciesPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: marketplaceAgentSessionsQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchMarketplaceAgentSessions(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <PharmaciesClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
