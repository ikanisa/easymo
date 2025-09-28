import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listStaffNumbers, type PaginatedResult } from '@/lib/data-provider';
import type { StaffNumber } from '@/lib/schemas';

export type StaffNumbersQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
};

const staffNumbersKey = (params: StaffNumbersQueryParams) => ['staff-numbers', params] satisfies QueryKey;

export function fetchStaffNumbers(
  params: StaffNumbersQueryParams = { limit: 200 }
): Promise<PaginatedResult<StaffNumber>> {
  return listStaffNumbers(params);
}

export function useStaffNumbersQuery(
  params: StaffNumbersQueryParams = { limit: 200 },
  options?: UseQueryOptions<PaginatedResult<StaffNumber>, unknown, PaginatedResult<StaffNumber>>
) {
  return useQuery({
    queryKey: staffNumbersKey(params),
    queryFn: () => fetchStaffNumbers(params),
    ...options
  });
}

export const staffNumbersQueryKeys = {
  list: (params: StaffNumbersQueryParams = { limit: 200 }) => staffNumbersKey(params)
} as const;
