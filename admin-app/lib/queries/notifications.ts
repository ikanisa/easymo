import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-provider";
import { apiFetch } from "@/lib/api/client";
import { mockNotifications } from "@/lib/mock-data";
import type { NotificationOutbox } from "@/lib/schemas";

export type NotificationsQueryParams = {
  status?: NotificationOutbox["status"];
  limit?: number;
  offset?: number;
};

const notificationsKey = (params: NotificationsQueryParams) =>
  ["notifications", params] satisfies QueryKey;

export async function fetchNotifications(
  params: NotificationsQueryParams = { limit: 200 },
): Promise<PaginatedResult<NotificationOutbox>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.status) searchParams.set('status', params.status);

  const response = await apiFetch<{ data: NotificationOutbox[]; total: number; hasMore?: boolean }>(`/api/notifications?${searchParams.toString()}`);
  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total)
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockNotifications.length;
  const slice = mockNotifications.slice(offset, offset + limit);
  return {
    data: slice,
    total: mockNotifications.length,
    hasMore: offset + slice.length < mockNotifications.length
  };
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
