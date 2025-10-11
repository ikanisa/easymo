import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { Station } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import {
  listStations,
  type StationListParams,
} from "@/lib/stations/stations-service";

export type StationsQueryParams = StationListParams;

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
