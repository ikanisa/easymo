import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { fetchBarDashboard, type BarDashboardParams, type BarDashboardSnapshot } from "@/lib/bars/bars-dashboard-service";

export type BarDashboardQueryParams = BarDashboardParams;

const barDashboardKey = (params: BarDashboardQueryParams) => ["bar-dashboard", params] satisfies QueryKey;

export function useBarDashboardQuery(
  params: BarDashboardQueryParams,
  options?: UseQueryOptions<BarDashboardSnapshot, unknown, BarDashboardSnapshot>,
) {
  return useQuery({
    queryKey: barDashboardKey(params),
    queryFn: () => fetchBarDashboard(params),
    ...options,
  });
}

export const barDashboardQueryKeys = {
  detail: (params: BarDashboardQueryParams) => barDashboardKey(params),
};
