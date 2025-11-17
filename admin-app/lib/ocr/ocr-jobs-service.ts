import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type { OcrJob } from "@/lib/schemas";


export type OcrJobListParams = Pagination & {
  status?: OcrJob["status"];
  barId?: string;
};

export async function listOcrJobs(
  params: OcrJobListParams = {},
): Promise<PaginatedResult<OcrJob>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  // Fetch from live API

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) searchParams.set("status", params.status);
  if (params.barId) searchParams.set("barId", params.barId);

  const query = searchParams.toString();
  const url = query
    ? `${getAdminApiPath("ocr", "jobs")}?${query}`
    : getAdminApiPath("ocr", "jobs");

  const response = await apiFetch<{
    data: OcrJob[];
    total: number;
    hasMore?: boolean;
  }>(url);

  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
