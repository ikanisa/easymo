import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import type { BarListParams } from "@/lib/bars/bars-service";
import { listBars } from "@/lib/bars/bars-service";
import type { Bar } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";

export type BarsQueryParams = BarListParams;

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
