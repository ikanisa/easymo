import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { listMarketplaceAgentSessions, type MarketplaceAgentSessionListParams } from "@/lib/marketplace/agent-marketplace-service";
import type { MarketplaceAgentSession } from "@/lib/marketplace/types";
import type { PaginatedResult } from "@/lib/shared/pagination";

export type MarketplaceAgentSessionsQueryParams = MarketplaceAgentSessionListParams;

const marketplaceSessionsKey = (params: MarketplaceAgentSessionsQueryParams) =>
  ["marketplace-agent-sessions", params] satisfies QueryKey;

export function fetchMarketplaceAgentSessions(
  params: MarketplaceAgentSessionsQueryParams,
): Promise<PaginatedResult<MarketplaceAgentSession>> {
  return listMarketplaceAgentSessions(params);
}

type MarketplaceAgentSessionsQueryOptions = Omit<
  UseQueryOptions<
    PaginatedResult<MarketplaceAgentSession>,
    unknown,
    PaginatedResult<MarketplaceAgentSession>
  >,
  "queryKey" | "queryFn"
>;

export function useMarketplaceAgentSessionsQuery(
  params: MarketplaceAgentSessionsQueryParams,
  options?: MarketplaceAgentSessionsQueryOptions,
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
