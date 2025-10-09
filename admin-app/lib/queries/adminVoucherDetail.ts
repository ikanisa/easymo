import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getAdminVoucherDetail } from "@/lib/data-provider";
import type { AdminVoucherDetail } from "@/lib/schemas";

const adminVoucherDetailKey = (voucherId: string): QueryKey => [
  "admin",
  "vouchers",
  "detail",
  voucherId,
];

export function fetchAdminVoucherDetail(
  voucherId: string,
): Promise<AdminVoucherDetail> {
  return getAdminVoucherDetail(voucherId);
}

export function useAdminVoucherDetailQuery(
  voucherId: string | null,
  options?: UseQueryOptions<AdminVoucherDetail, unknown, AdminVoucherDetail>,
) {
  return useQuery({
    queryKey: voucherId ? adminVoucherDetailKey(voucherId) : adminVoucherDetailKey("pending"),
    queryFn: () => {
      if (!voucherId) {
        throw new Error("Voucher ID required");
      }
      return fetchAdminVoucherDetail(voucherId);
    },
    enabled: Boolean(voucherId),
    ...options,
  });
}

export const adminVoucherDetailQueryKeys = {
  detail: (voucherId: string) => adminVoucherDetailKey(voucherId),
} as const;
