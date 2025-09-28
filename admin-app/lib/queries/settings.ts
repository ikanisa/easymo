import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listSettingsPreview, type PaginatedResult } from '@/lib/data-provider';
import type { SettingEntry, TemplateMeta } from '@/lib/schemas';

export type SettingsPreviewParams = {
  limit?: number;
};

const settingsPreviewKey = (params: SettingsPreviewParams) => ['settings-preview', params] satisfies QueryKey;

export function fetchSettingsPreview(
  params: SettingsPreviewParams = { limit: 100 }
): Promise<PaginatedResult<SettingEntry>> {
  return listSettingsPreview(params);
}

export function useSettingsPreviewQuery(
  params: SettingsPreviewParams = { limit: 100 },
  options?: UseQueryOptions<PaginatedResult<SettingEntry>, unknown, PaginatedResult<SettingEntry>>
) {
  return useQuery({
    queryKey: settingsPreviewKey(params),
    queryFn: () => fetchSettingsPreview(params),
    ...options
  });
}

export const settingsQueryKeys = {
  preview: (params: SettingsPreviewParams = { limit: 100 }) => settingsPreviewKey(params)
} as const;
