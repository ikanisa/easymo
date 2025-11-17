import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import type { NotificationOutbox } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";

export type NotificationListParams = Pagination & {
  status?: NotificationOutbox["status"];
};

export async function listNotifications(
  params: NotificationListParams = {},
): Promise<PaginatedResult<NotificationOutbox>> {
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();
  const url = query
    ? `${getAdminApiPath("notifications")}?${query}`
    : getAdminApiPath("notifications");

  try {
    const response = await apiFetch<{
      data: NotificationOutbox[];
      total: number;
      hasMore?: boolean;
    }>(url);

    return {
      data: response.data,
      total: response.total,
      hasMore: response.hasMore ?? (offset + response.data.length < response.total),
    };
  } catch (error) {
    console.error("Failed to fetch notifications", error);
    return paginateArray([], params);
  }
}
