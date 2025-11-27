import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import { getAdminDiagnostics } from "@/lib/admin/diagnostics-service";
import type { AdminDiagnosticsSnapshot } from "@/lib/schemas";

const ADMIN_DIAGNOSTICS_KEY: QueryKey = ["admin", "diagnostics", "snapshot"];

export function fetchAdminDiagnostics(): Promise<AdminDiagnosticsSnapshot> {
  return getAdminDiagnostics();
}

export function useAdminDiagnosticsQuery(
  options?: UseQueryOptions<AdminDiagnosticsSnapshot, unknown, AdminDiagnosticsSnapshot>,
) {
  return useQuery({
    queryKey: ADMIN_DIAGNOSTICS_KEY,
    queryFn: fetchAdminDiagnostics,
    ...options,
  });
}

export const adminDiagnosticsQueryKeys = {
  snapshot: () => ADMIN_DIAGNOSTICS_KEY,
} as const;
