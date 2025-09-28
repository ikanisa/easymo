import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listFlows, type PaginatedResult } from '@/lib/data-provider';
import type { FlowMeta } from '@/lib/schemas';

export type FlowsQueryParams = {
  limit?: number;
  offset?: number;
  status?: FlowMeta['status'];
};

const flowsKey = (params: FlowsQueryParams) => ['flows', params] satisfies QueryKey;

export function fetchFlows(params: FlowsQueryParams = { limit: 100 }): Promise<PaginatedResult<FlowMeta>> {
  return listFlows(params);
}

export function useFlowsQuery(
  params: FlowsQueryParams = { limit: 100 },
  options?: UseQueryOptions<PaginatedResult<FlowMeta>, unknown, PaginatedResult<FlowMeta>>
) {
  return useQuery({
    queryKey: flowsKey(params),
    queryFn: () => fetchFlows(params),
    ...options
  });
}

export const flowsQueryKeys = {
  list: (params: FlowsQueryParams = { limit: 100 }) => flowsKey(params)
} as const;
