export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchMarketplaceAgentSessions,
  marketplaceAgentSessionsQueryKeys,
  type MarketplaceAgentSessionsQueryParams,
} from "@/lib/queries/marketplaceAgentSessions";
import { PropertyRentalsClient } from "./PropertyRentalsClient";

const DEFAULT_PARAMS: MarketplaceAgentSessionsQueryParams = {
  agentType: "property_rental",
  flowType: "property_rental",
  limit: 25,
};

export default async function PropertyRentalsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: marketplaceAgentSessionsQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchMarketplaceAgentSessions(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <PropertyRentalsClient params={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
