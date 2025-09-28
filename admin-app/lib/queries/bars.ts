import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { listBars, type PaginatedResult } from "@/lib/data-provider";
import type { Bar } from "@/lib/schemas";

export type BarsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
};

const barsKey = (params: BarsQueryParams) =>
  ["bars", params] satisfies QueryKey;

export function fetchBars(
  params: BarsQueryParams = { limit: 100 },
): Promise<PaginatedResult<Bar>> {
  return listBars(params);
}

export function useBarsQuery(
  params: BarsQueryParams = { limit: 100 },
  options?: UseQueryOptions<
    PaginatedResult<Bar>,
    unknown,
    PaginatedResult<Bar>
  >,
) {
  return useQuery({
    queryKey: barsKey(params),
    queryFn: () => fetchBars(params),
    ...options,
  });
}

export const barsQueryKeys = {
  list: (params: BarsQueryParams = { limit: 100 }) => barsKey(params),
} as const;
