import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type { QrToken } from "@/lib/schemas";

export type QrTokenListParams = Pagination & {
  printed?: boolean;
  stationId?: string;
};

export async function listQrTokens(
  params: QrTokenListParams = {},
): Promise<PaginatedResult<QrToken>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.printed !== undefined) {
    searchParams.set("printed", params.printed ? "true" : "false");
  }
  if (params.stationId) {
    searchParams.set("stationId", params.stationId);
  }

  const url = `${getAdminApiPath("qr")}?${searchParams.toString()}`;
  
  const response = await apiFetch<{
    data: QrToken[];
    total: number;
    hasMore?: boolean;
  }>(url);

  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
