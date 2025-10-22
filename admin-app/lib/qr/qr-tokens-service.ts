import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockQrTokens } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { QrToken } from "@/lib/schemas";

const useMocks = shouldUseMocks();

export type QrTokenListParams = Pagination & {
  printed?: boolean;
  stationId?: string;
};

export async function listQrTokens(
  params: QrTokenListParams = {},
): Promise<PaginatedResult<QrToken>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  if (useMocks) {
    return paginateArray(mockQrTokens, { offset, limit });
  }

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

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? (offset + data.length < total),
    };
  }

  console.error("Failed to fetch QR tokens", response.error);
  return paginateArray(mockQrTokens, { offset, limit });
}
