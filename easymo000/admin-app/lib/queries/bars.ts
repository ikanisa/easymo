import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-provider";
import { apiFetch } from "@/lib/api/client";
import { mockBars } from "@/lib/mock-data";
import type { Bar } from "@/lib/schemas";

export type BarsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
};

const barsKey = (params: BarsQueryParams) =>
  ["bars", params] satisfies QueryKey;

export async function fetchBars(
  params: BarsQueryParams = { limit: 100 },
): Promise<PaginatedResult<Bar>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);

  const response = await apiFetch<{
    data: Bar[];
    total: number;
    hasMore?: boolean;
    integration?: unknown;
  }>(`/api/bars?${searchParams.toString()}`);

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total),
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockBars.length;
  const filtered = mockBars.filter((bar) => {
    const statusMatch = params.status
      ? bar.isActive === (params.status === "active")
      : true;
    const searchMatch = params.search
      ? `${bar.name} ${bar.location ?? ""}`.toLowerCase().includes(
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
