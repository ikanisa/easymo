import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/shared/pagination";
import type { NotificationOutbox } from "@/lib/schemas";
import {
  listNotifications,
  type NotificationListParams,
} from "@/lib/notifications/notifications-service";

export type NotificationsQueryParams = NotificationListParams;

const notificationsKey = (params: NotificationsQueryParams) =>
  ["notifications", params] satisfies QueryKey;

export async function fetchNotifications(
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
