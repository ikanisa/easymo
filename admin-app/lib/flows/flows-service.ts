import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import type { FlowMeta } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export type FlowListParams = Pagination & {
  status?: FlowMeta["status"];
};

export async function listFlows(
  params: FlowListParams = {},
): Promise<PaginatedResult<FlowMeta>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) searchParams.set("status", params.status);

  const response = await apiFetch<{ data: FlowMeta[]; total: number; hasMore?: boolean }>(
    `${getAdminApiPath("flows")}?${searchParams.toString()}`,
  );
  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
