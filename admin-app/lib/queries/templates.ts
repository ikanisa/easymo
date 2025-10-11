import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { TemplateMeta } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import {
  listTemplates,
  type TemplateListParams,
} from "@/lib/templates/templates-service";

export type TemplatesQueryParams = TemplateListParams;

const templatesKey = (params: TemplatesQueryParams) =>
  ["templates", params] satisfies QueryKey;

export function fetchTemplates(
  params: TemplatesQueryParams = { limit: 50 },
): Promise<PaginatedResult<TemplateMeta>> {
  return listTemplates(params);
}

export function useTemplatesQuery(
  params: TemplatesQueryParams = { limit: 50 },
  options?: UseQueryOptions<
    PaginatedResult<TemplateMeta>,
    unknown,
    PaginatedResult<TemplateMeta>
  >,
) {
  return useQuery({
    queryKey: templatesKey(params),
    queryFn: () => fetchTemplates(params),
    ...options,
  });
}

export const templatesQueryKeys = {
  list: (params: TemplatesQueryParams = { limit: 50 }) => templatesKey(params),
} as const;
