import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import {
  listMenuVersions,
  type MenuVersionListParams,
} from "@/lib/menus/menu-versions-service";
import { listOcrJobs, type OcrJobListParams } from "@/lib/ocr/ocr-jobs-service";
import type { MenuVersion, OcrJob } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";

export type MenuQueryParams = MenuVersionListParams;

export type OcrJobQueryParams = OcrJobListParams;

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

type MenuVersionsQueryOptions = Omit<
  UseQueryOptions<PaginatedResult<MenuVersion>, unknown, PaginatedResult<MenuVersion>>,
  "queryKey" | "queryFn"
>;

type OcrJobsQueryOptions = Omit<
  UseQueryOptions<PaginatedResult<OcrJob>, unknown, PaginatedResult<OcrJob>>,
  "queryKey" | "queryFn"
>;

export function useMenuVersionsQuery(
  params: MenuQueryParams = { limit: 100 },
  options?: MenuVersionsQueryOptions,
) {
  return useQuery({
    queryKey: menuKey(params),
    queryFn: () => fetchMenuVersions(params),
    ...options,
  });
}

export function useOcrJobsQuery(
  params: OcrJobQueryParams = { limit: 50 },
  options?: OcrJobsQueryOptions,
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
