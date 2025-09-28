import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { listStations, type PaginatedResult } from "@/lib/data-provider";
import type { Station } from "@/lib/schemas";

export type StationsQueryParams = {
  search?: string;
  status?: Station["status"];
  offset?: number;
  limit?: number;
};

const stationsKey = (params: StationsQueryParams) =>
  ["stations", params] satisfies QueryKey;

export function fetchStations(
  params: StationsQueryParams = { limit: 200 },
): Promise<PaginatedResult<Station>> {
  return listStations(params);
}

export function useStationsQuery(
  params: StationsQueryParams = { limit: 200 },
  options?: UseQueryOptions<
    PaginatedResult<Station>,
    unknown,
    PaginatedResult<Station>
  >,
) {
  return useQuery({
    queryKey: stationsKey(params),
    queryFn: () => fetchStations(params),
    ...options,
  });
}

export const stationsQueryKeys = {
  list: (params: StationsQueryParams = { limit: 200 }) => stationsKey(params),
} as const;
