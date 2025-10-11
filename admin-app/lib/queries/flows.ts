import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { FlowMeta } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import { type FlowListParams, listFlows } from "@/lib/flows/flows-service";

export type FlowsQueryParams = FlowListParams;

const flowsKey = (params: FlowsQueryParams) =>
  ["flows", params] satisfies QueryKey;

export function fetchFlows(
  params: FlowsQueryParams = { limit: 100 },
): Promise<PaginatedResult<FlowMeta>> {
  return listFlows(params);
}

export function useFlowsQuery(
  params: FlowsQueryParams = { limit: 100 },
  options?: UseQueryOptions<
    PaginatedResult<FlowMeta>,
    unknown,
    PaginatedResult<FlowMeta>
  >,
) {
  return useQuery({
    queryKey: flowsKey(params),
    queryFn: () => fetchFlows(params),
    ...options,
  });
}

export const flowsQueryKeys = {
  list: (params: FlowsQueryParams = { limit: 100 }) => flowsKey(params),
} as const;
