import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-provider";
import { apiFetch } from "@/lib/api/client";
import { mockStaffNumbers } from "@/lib/mock-data";
import type { StaffNumber } from "@/lib/schemas";

export type StaffNumbersQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  role?: string;
  active?: boolean;
};

const staffNumbersKey = (params: StaffNumbersQueryParams) =>
  ["staff-numbers", params] satisfies QueryKey;

export async function fetchStaffNumbers(
  params: StaffNumbersQueryParams = { limit: 200 },
): Promise<PaginatedResult<StaffNumber>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.role) searchParams.set("role", params.role);
  if (typeof params.active === "boolean") {
    searchParams.set("active", params.active ? "true" : "false");
  }

  const response = await apiFetch<{
    data: StaffNumber[];
    total: number;
    hasMore?: boolean;
    integration?: unknown;
  }>(`/api/staff?${searchParams.toString()}`);

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total),
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockStaffNumbers.length;
  const filtered = mockStaffNumbers.filter((staff) => {
    const searchMatch = params.search
      ? `${staff.barName} ${staff.number}`.toLowerCase().includes(
        params.search.toLowerCase(),
      )
      : true;
    return searchMatch;
  });
  const slice = filtered.slice(offset, offset + limit);
  return {
    data: slice,
    total: filtered.length,
    hasMore: offset + slice.length < filtered.length,
  };
}

export function useStaffNumbersQuery(
  params: StaffNumbersQueryParams = { limit: 200 },
  options?: UseQueryOptions<
    PaginatedResult<StaffNumber>,
    unknown,
    PaginatedResult<StaffNumber>
  >,
) {
  return useQuery({
    queryKey: staffNumbersKey(params),
    queryFn: () => fetchStaffNumbers(params),
    ...options,
  });
}

export const staffNumbersQueryKeys = {
  list: (params: StaffNumbersQueryParams = { limit: 200 }) =>
    staffNumbersKey(params),
} as const;
