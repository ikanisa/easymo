export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchMarketplaceAgentSessions,
  marketplaceAgentSessionsQueryKeys,
  type MarketplaceAgentSessionsQueryParams,
} from "@/lib/queries/marketplaceAgentSessions";

import { QuincailleriesClient } from "./QuincailleriesClient";

const DEFAULT_PARAMS: MarketplaceAgentSessionsQueryParams = {
  agentType: "quincaillerie",
  flowType: "nearby_quincailleries",
  limit: 25,
};

export default async function QuincailleriesPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: marketplaceAgentSessionsQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchMarketplaceAgentSessions(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <QuincailleriesClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
