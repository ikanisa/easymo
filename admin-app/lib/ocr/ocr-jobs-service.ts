import { apiFetch } from "@/lib/api/client";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockOcrJobs } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { OcrJob } from "@/lib/schemas";

const useMocks = shouldUseMocks();

export type OcrJobListParams = Pagination & {
  status?: OcrJob["status"];
  barId?: string;
};

export async function listOcrJobs(
  params: OcrJobListParams = {},
): Promise<PaginatedResult<OcrJob>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  const applyFilter = (collection: OcrJob[]) =>
    collection.filter((job) => {
      const statusMatch = params.status ? job.status === params.status : true;
      const barMatch = params.barId ? job.barId === params.barId : true;
      return statusMatch && barMatch;
    });

  if (useMocks) {
    return paginateArray(applyFilter(mockOcrJobs), { offset, limit });
  }

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) searchParams.set("status", params.status);
  if (params.barId) searchParams.set("barId", params.barId);

  const query = searchParams.toString();
  const url = query ? `/api/ocr/jobs?${query}` : "/api/ocr/jobs";

  const response = await apiFetch<{
    data: OcrJob[];
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

  console.error("Failed to fetch OCR jobs", response.error);
  return paginateArray(applyFilter(mockOcrJobs), { offset, limit });
}
