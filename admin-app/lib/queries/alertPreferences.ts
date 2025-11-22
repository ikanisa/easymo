import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import {
  type AdminAlertPreferencesResult,
  listAdminAlertPreferences,
} from "@/lib/settings/alert-preferences-service";

const alertPreferencesKey = ["admin-alert-preferences"] satisfies QueryKey;

export function fetchAdminAlertPreferences(): Promise<
  AdminAlertPreferencesResult
> {
  return listAdminAlertPreferences();
}

export function useAdminAlertPreferencesQuery(
  options?: UseQueryOptions<
    AdminAlertPreferencesResult,
    unknown,
    AdminAlertPreferencesResult
  >,
) {
  return useQuery({
    queryKey: alertPreferencesKey,
    queryFn: fetchAdminAlertPreferences,
    ...options,
  });
}

export const alertPreferencesQueryKeys = {
  all: () => alertPreferencesKey,
} as const;
