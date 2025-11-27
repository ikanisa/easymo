import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import { getAdminHubSnapshot } from "@/lib/admin/admin-hub-service";
import type { AdminHubSnapshot } from "@/lib/schemas";

const ADMIN_HUB_SNAPSHOT_KEY: QueryKey = ["admin", "hub", "snapshot"];

export function fetchAdminHubSnapshot(): Promise<AdminHubSnapshot> {
  return getAdminHubSnapshot();
}

type AdminHubSnapshotQueryOptions = Omit<
  UseQueryOptions<AdminHubSnapshot, unknown, AdminHubSnapshot>,
  "queryKey" | "queryFn"
>;

export function useAdminHubSnapshotQuery(
  options?: AdminHubSnapshotQueryOptions,
) {
  return useQuery({
    queryKey: ADMIN_HUB_SNAPSHOT_KEY,
    queryFn: fetchAdminHubSnapshot,
    ...options,
  });
}

export const adminHubQueryKeys = {
  snapshot: () => ADMIN_HUB_SNAPSHOT_KEY,
} as const;
