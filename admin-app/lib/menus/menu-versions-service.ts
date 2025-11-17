import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type { MenuVersion } from "@/lib/schemas";

export type MenuVersionListParams = Pagination & {
  status?: MenuVersion["status"];
  barId?: string;
};

export async function listMenuVersions(
  params: MenuVersionListParams = {},
): Promise<PaginatedResult<MenuVersion>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  // Always query live API

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) searchParams.set("status", params.status);
  if (params.barId) searchParams.set("barId", params.barId);

  const query = searchParams.toString();
  const url = query
    ? `${getAdminApiPath("menus")}?${query}`
    : getAdminApiPath("menus");

  const response = await apiFetch<{
    data: MenuVersion[];
    total: number;
    hasMore?: boolean;
  }>(url);

  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
