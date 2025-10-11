import { apiFetch } from "@/lib/api/client";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockNotifications } from "@/lib/mock-data";
import type { NotificationOutbox } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";

const useMocks = shouldUseMocks();

export type NotificationListParams = Pagination & {
  status?: NotificationOutbox["status"];
};

export async function listNotifications(
  params: NotificationListParams = {},
): Promise<PaginatedResult<NotificationOutbox>> {
  if (useMocks) {
    const filtered = params.status
      ? mockNotifications.filter((item) => item.status === params.status)
      : mockNotifications;
    return paginateArray(filtered, params);
  }

  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();
  const url = query ? `/api/notifications?${query}` : "/api/notifications";

  const response = await apiFetch<{
    data: NotificationOutbox[];
    total: number;
    hasMore?: boolean;
  }>(url);

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? (offset + data.length < total),
    };
  }

  console.error("Failed to fetch notifications", response.error);
  const fallback = params.status
    ? mockNotifications.filter((item) => item.status === params.status)
    : mockNotifications;
  return paginateArray(fallback, params);
}
