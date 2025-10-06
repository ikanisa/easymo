import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-provider";
import { apiFetch } from "@/lib/api/client";
import { mockStations } from "@/lib/mock-data";
import type { Station } from "@/lib/schemas";

export type StationsQueryParams = {
  search?: string;
  status?: Station["status"];
  offset?: number;
  limit?: number;
};

const stationsKey = (params: StationsQueryParams) =>
  ["stations", params] satisfies QueryKey;

export async function fetchStations(
  params: StationsQueryParams = { limit: 200 },
): Promise<PaginatedResult<Station>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const response = await apiFetch<
    { data: Station[]; total: number; hasMore?: boolean }
  >(`/api/stations?${searchParams.toString()}`);

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total),
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockStations.length;
  const filtered = mockStations.filter((station) => {
    const statusMatch = params.status ? station.status === params.status : true;
    const searchMatch = params.search
      ? `${station.name} ${station.engencode}`.toLowerCase().includes(
        params.search.toLowerCase(),
      )
      : true;
    return statusMatch && searchMatch;
  });
  const slice = filtered.slice(offset, offset + limit);
  return {
    data: slice,
    total: filtered.length,
    hasMore: offset + slice.length < filtered.length,
  };
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
