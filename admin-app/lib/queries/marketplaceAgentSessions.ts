import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  listMarketplaceAgentSessions,
  type MarketplaceAgentSession,
  type MarketplaceAgentSessionListParams,
} from "@/lib/marketplace/agent-marketplace-service";
import type { PaginatedResult } from "@/lib/shared/pagination";

export type MarketplaceAgentSessionsQueryParams = MarketplaceAgentSessionListParams;

const marketplaceSessionsKey = (params: MarketplaceAgentSessionsQueryParams) =>
  ["marketplace-agent-sessions", params] satisfies QueryKey;

export function fetchMarketplaceAgentSessions(
  params: MarketplaceAgentSessionsQueryParams,
): Promise<PaginatedResult<MarketplaceAgentSession>> {
  return listMarketplaceAgentSessions(params);
}

export function useMarketplaceAgentSessionsQuery(
  params: MarketplaceAgentSessionsQueryParams,
  options?: UseQueryOptions<
    PaginatedResult<MarketplaceAgentSession>,
    unknown,
    PaginatedResult<MarketplaceAgentSession>
  >,
) {
  return useQuery({
    queryKey: marketplaceSessionsKey(params),
    queryFn: () => fetchMarketplaceAgentSessions(params),
    ...options,
  });
}

export const marketplaceAgentSessionsQueryKeys = {
  list: (params: MarketplaceAgentSessionsQueryParams) => marketplaceSessionsKey(params),
} as const;
