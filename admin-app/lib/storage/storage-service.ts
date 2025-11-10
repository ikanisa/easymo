import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockStorageObjects } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { StorageObject } from "@/lib/schemas";

const useMocks = shouldUseMocks();

export type StorageListParams = Pagination & {
  bucket?: string;
  search?: string;
};

export async function listStorageObjects(
  params: StorageListParams = {},
): Promise<PaginatedResult<StorageObject>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (useMocks) {
    return paginateArray(mockStorageObjects, { offset, limit });
  }

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.bucket) searchParams.set("bucket", params.bucket);
  if (params.search) searchParams.set("search", params.search);

  try {
    const response = await apiFetch<{
      data: StorageObject[];
      total: number;
      hasMore?: boolean;
    }>(`${getAdminApiPath("storage")}?${searchParams.toString()}`);

    return {
      data: response.data,
      total: response.total,
      hasMore: response.hasMore ?? (offset + response.data.length < response.total),
    };
  } catch (error) {
    console.error("Failed to fetch storage objects", error);
    return paginateArray(mockStorageObjects, { offset, limit });
  }
}
