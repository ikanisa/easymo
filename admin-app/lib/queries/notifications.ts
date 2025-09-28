import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { listNotifications, type PaginatedResult } from "@/lib/data-provider";
import type { NotificationOutbox } from "@/lib/schemas";

export type NotificationsQueryParams = {
  status?: NotificationOutbox["status"];
  limit?: number;
  offset?: number;
};

const notificationsKey = (params: NotificationsQueryParams) =>
  ["notifications", params] satisfies QueryKey;

export function fetchNotifications(
  params: NotificationsQueryParams = { limit: 200 },
): Promise<PaginatedResult<NotificationOutbox>> {
  return listNotifications(params);
}

export function useNotificationsQuery(
  params: NotificationsQueryParams = { limit: 200 },
  options?: UseQueryOptions<
    PaginatedResult<NotificationOutbox>,
    unknown,
    PaginatedResult<NotificationOutbox>
  >,
) {
  return useQuery({
    queryKey: notificationsKey(params),
    queryFn: () => fetchNotifications(params),
    ...options,
  });
}

export const notificationsQueryKeys = {
  list: (params: NotificationsQueryParams = { limit: 200 }) =>
    notificationsKey(params),
} as const;
