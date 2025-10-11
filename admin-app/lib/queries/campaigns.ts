import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { Campaign } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import { listCampaigns } from "@/lib/campaigns/campaigns-service";
import type { Pagination } from "@/lib/shared/pagination";

export type CampaignsQueryParams = Pagination & {
  status?: Campaign["status"];
  search?: string;
};

const campaignsKey = (params: CampaignsQueryParams) =>
  ["campaigns", params] satisfies QueryKey;

export function fetchCampaigns(
  params: CampaignsQueryParams = { limit: 100 },
): Promise<PaginatedResult<Campaign>> {
  return listCampaigns(params);
}

export function useCampaignsQuery(
  params: CampaignsQueryParams = { limit: 100 },
  options?: UseQueryOptions<
    PaginatedResult<Campaign>,
    unknown,
    PaginatedResult<Campaign>
  >,
) {
  return useQuery({
    queryKey: campaignsKey(params),
    queryFn: () => fetchCampaigns(params),
    ...options,
  });
}

export const campaignsQueryKeys = {
  list: (params: CampaignsQueryParams = { limit: 100 }) => campaignsKey(params),
} as const;
