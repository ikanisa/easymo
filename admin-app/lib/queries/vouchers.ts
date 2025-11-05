import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { Voucher } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/data-provider";
import { listVouchers, type VoucherListParams } from "@/lib/data-provider";

export type VouchersQueryParams = VoucherListParams;

const vouchersKey = (params: VouchersQueryParams) =>
  ["vouchers", params] satisfies QueryKey;

export function fetchVouchers(
  params: VouchersQueryParams = { limit: 50 },
): Promise<PaginatedResult<Voucher>> {
  return listVouchers(params);
}

export function useVouchersQuery(
  params: VouchersQueryParams = { limit: 50 },
  options?: UseQueryOptions<
    PaginatedResult<Voucher>,
    unknown,
    PaginatedResult<Voucher>
  >,
) {
  return useQuery({
    queryKey: vouchersKey(params),
    queryFn: () => fetchVouchers(params),
    ...options,
  });
}

export const vouchersQueryKeys = {
  list: (params: VouchersQueryParams = { limit: 50 }) => vouchersKey(params),
} as const;
