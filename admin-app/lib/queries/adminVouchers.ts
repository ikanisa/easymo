import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getAdminVoucherRecent } from "@/lib/admin/admin-vouchers-service";
import type { AdminVoucherList } from "@/lib/schemas";

const ADMIN_VOUCHER_RECENT_KEY: QueryKey = ["admin", "vouchers", "recent"];

export function fetchAdminVoucherRecent(): Promise<AdminVoucherList> {
  return getAdminVoucherRecent();
}

export function useAdminVoucherRecentQuery(
  options?: UseQueryOptions<AdminVoucherList, unknown, AdminVoucherList>,
) {
  return useQuery({
    queryKey: ADMIN_VOUCHER_RECENT_KEY,
    queryFn: fetchAdminVoucherRecent,
    ...options,
  });
}

export const adminVoucherQueryKeys = {
  recent: () => ADMIN_VOUCHER_RECENT_KEY,
} as const;
