import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listTemplates, type PaginatedResult } from '@/lib/data-provider';
import type { TemplateMeta } from '@/lib/schemas';

export type TemplatesQueryParams = {
  limit?: number;
  status?: TemplateMeta['status'];
};

const templatesKey = (params: TemplatesQueryParams) => ['templates', params] satisfies QueryKey;

export function fetchTemplates(
  params: TemplatesQueryParams = { limit: 50 }
): Promise<PaginatedResult<TemplateMeta>> {
  return listTemplates(params);
}

export function useTemplatesQuery(
  params: TemplatesQueryParams = { limit: 50 },
  options?: UseQueryOptions<PaginatedResult<TemplateMeta>, unknown, PaginatedResult<TemplateMeta>>
) {
  return useQuery({
    queryKey: templatesKey(params),
    queryFn: () => fetchTemplates(params),
    ...options
  });
}

export const templatesQueryKeys = {
  list: (params: TemplatesQueryParams = { limit: 50 }) => templatesKey(params)
} as const;
