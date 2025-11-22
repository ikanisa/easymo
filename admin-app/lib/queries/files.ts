import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import type { StorageObject } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import {
  listStorageObjects,
  type StorageListParams,
} from "@/lib/storage/storage-service";

export type StorageQueryParams = StorageListParams;

const storageKey = (params: StorageQueryParams) =>
  ["storage-objects", params] satisfies QueryKey;

export function fetchStorageObjects(
  params: StorageQueryParams = { limit: 200 },
): Promise<PaginatedResult<StorageObject>> {
  return listStorageObjects(params);
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
