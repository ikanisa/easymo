import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type { Bar } from "@/lib/schemas";

export type BarListParams = Pagination & {
  search?: string;
  status?: "active" | "inactive";
  claimed?: boolean;
};

export async function listBars(
  params: BarListParams = {},
): Promise<PaginatedResult<Bar>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.claimed !== undefined) searchParams.set("claimed", params.claimed ? "true" : "false");

  const response = await apiFetch<{
    data: Bar[];
    total: number;
    hasMore?: boolean;
  }>(`${getAdminApiPath("bars")}?${searchParams.toString()}`);

  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
