import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-provider";
import { apiFetch } from "@/lib/api/client";
import { mockStorageObjects } from "@/lib/mock-data";
import type { StorageObject } from "@/lib/schemas";

export type StorageQueryParams = {
  bucket?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

const storageKey = (params: StorageQueryParams) =>
  ["storage-objects", params] satisfies QueryKey;

export async function fetchStorageObjects(
  params: StorageQueryParams = { limit: 200 },
): Promise<PaginatedResult<StorageObject>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.bucket) searchParams.set('bucket', params.bucket);
  if (params.search) searchParams.set('search', params.search);

  const response = await apiFetch<{ data: StorageObject[]; total: number; hasMore?: boolean }>(`/api/storage?${searchParams.toString()}`);
  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total)
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockStorageObjects.length;
  const slice = mockStorageObjects.slice(offset, offset + limit);
  return {
    data: slice,
    total: mockStorageObjects.length,
    hasMore: offset + slice.length < mockStorageObjects.length
  };
}

export function useStorageObjectsQuery(
  params: StorageQueryParams = { limit: 200 },
  options?: UseQueryOptions<
    PaginatedResult<StorageObject>,
    unknown,
    PaginatedResult<StorageObject>
  >,
) {
  return useQuery({
    queryKey: storageKey(params),
    queryFn: () => fetchStorageObjects(params),
    ...options,
  });
}

export const storageQueryKeys = {
  list: (params: StorageQueryParams = { limit: 200 }) => storageKey(params),
} as const;
