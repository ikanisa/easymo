import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  listMenuVersions,
  listOcrJobs,
  type PaginatedResult,
} from "@/lib/data-provider";
import type { MenuVersion, OcrJob } from "@/lib/schemas";

export type MenuQueryParams = {
  status?: MenuVersion["status"];
  limit?: number;
  offset?: number;
};

export type OcrJobQueryParams = {
  status?: OcrJob["status"];
  limit?: number;
  offset?: number;
};

const menuKey = (params: MenuQueryParams) =>
  ["menu-versions", params] satisfies QueryKey;
const ocrKey = (params: OcrJobQueryParams) =>
  ["ocr-jobs", params] satisfies QueryKey;

export function fetchMenuVersions(
  params: MenuQueryParams = { limit: 100 },
): Promise<PaginatedResult<MenuVersion>> {
  return listMenuVersions(params);
}

export function fetchOcrJobs(
  params: OcrJobQueryParams = { limit: 50 },
): Promise<PaginatedResult<OcrJob>> {
  return listOcrJobs(params);
}

export function useMenuVersionsQuery(
  params: MenuQueryParams = { limit: 100 },
  options?: UseQueryOptions<
    PaginatedResult<MenuVersion>,
    unknown,
    PaginatedResult<MenuVersion>
  >,
) {
  return useQuery({
    queryKey: menuKey(params),
    queryFn: () => fetchMenuVersions(params),
    ...options,
  });
}

export function useOcrJobsQuery(
  params: OcrJobQueryParams = { limit: 50 },
  options?: UseQueryOptions<
    PaginatedResult<OcrJob>,
    unknown,
    PaginatedResult<OcrJob>
  >,
) {
  return useQuery({
    queryKey: ocrKey(params),
    queryFn: () => fetchOcrJobs(params),
    ...options,
  });
}

export const menuQueryKeys = {
  versions: (params: MenuQueryParams = { limit: 100 }) => menuKey(params),
} as const;

export const ocrJobQueryKeys = {
  list: (params: OcrJobQueryParams = { limit: 50 }) => ocrKey(params),
} as const;
