import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import type { StaffNumber } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import {
  listStaffNumbers,
  type StaffNumberListParams,
} from "@/lib/staff/staff-numbers-service";

export type StaffNumbersQueryParams = StaffNumberListParams;

const staffNumbersKey = (params: StaffNumbersQueryParams) =>
  ["staff-numbers", params] satisfies QueryKey;

export function fetchStaffNumbers(
  params: StaffNumbersQueryParams = { limit: 200 },
): Promise<PaginatedResult<StaffNumber>> {
  return listStaffNumbers(params);
}

type StaffNumbersQueryOptions = Omit<
  UseQueryOptions<PaginatedResult<StaffNumber>, unknown, PaginatedResult<StaffNumber>>,
  "queryKey" | "queryFn"
>;

export function useStaffNumbersQuery(
  params: StaffNumbersQueryParams = { limit: 200 },
  options?: StaffNumbersQueryOptions,
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
