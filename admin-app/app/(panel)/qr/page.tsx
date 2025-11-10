export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { QrClient } from "./QrClient";
import {
  fetchQrTokens,
  qrQueryKeys,
  type QrTokensQueryParams,
} from "@/lib/queries/qr";
import {
  barsQueryKeys,
  type BarsQueryParams,
  fetchBars,
} from "@/lib/queries/bars";
import {
  fetchMarketplaceAgentSessions,
  marketplaceAgentSessionsQueryKeys,
  type MarketplaceAgentSessionsQueryParams,
} from "@/lib/queries/marketplaceAgentSessions";

const DEFAULT_TOKEN_PARAMS: QrTokensQueryParams = { limit: 100 };
const DEFAULT_BAR_PARAMS: BarsQueryParams = { limit: 100 };
const DEFAULT_PROPERTY_PARAMS: MarketplaceAgentSessionsQueryParams = {
  agentType: "property_rental",
  flowType: "property_rental",
  limit: 20,
};

export default async function QrPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qrQueryKeys.list(DEFAULT_TOKEN_PARAMS),
      queryFn: () => fetchQrTokens(DEFAULT_TOKEN_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: barsQueryKeys.list(DEFAULT_BAR_PARAMS),
      queryFn: () => fetchBars(DEFAULT_BAR_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: marketplaceAgentSessionsQueryKeys.list(DEFAULT_PROPERTY_PARAMS),
      queryFn: () => fetchMarketplaceAgentSessions(DEFAULT_PROPERTY_PARAMS),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <QrClient
        initialTokenParams={DEFAULT_TOKEN_PARAMS}
        initialBarParams={DEFAULT_BAR_PARAMS}
        propertyParams={DEFAULT_PROPERTY_PARAMS}
      />
    </HydrationBoundary>
  );
}
