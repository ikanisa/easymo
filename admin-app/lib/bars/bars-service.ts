import { apiFetch } from "@/lib/api/client";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockBars } from "@/lib/mock-data";
import { matchesSearch } from "@/lib/shared/search";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { Bar } from "@/lib/schemas";

const useMocks = shouldUseMocks();

export type BarListParams = Pagination & {
  search?: string;
  status?: "active" | "inactive";
};

export async function listBars(
  params: BarListParams = {},
): Promise<PaginatedResult<Bar>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 100;

  if (useMocks) {
    const filtered = filterBars(mockBars, params);
    return paginateArray(filtered, { offset, limit });
  }

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);

  const response = await apiFetch<{
    data: Bar[];
    total: number;
    hasMore?: boolean;
  }>(`/api/bars?${searchParams.toString()}`);

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? (offset + data.length < total),
    };
  }

  console.error("Failed to fetch bars", response.error);
  const fallback = filterBars(mockBars, params);
  return paginateArray(fallback, { offset, limit });
}

function filterBars(bars: Bar[], params: BarListParams) {
  return bars.filter((bar) => {
    const statusMatch = params.status
      ? bar.isActive === (params.status === "active")
      : true;
    const searchMatch = matchesSearch(
      `${bar.name} ${bar.location ?? ""}`,
      params.search,
    );
    return statusMatch && searchMatch;
  });
}
