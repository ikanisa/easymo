import { mockTemplates } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { TemplateMeta } from "@/lib/schemas";

export type TemplateListParams = Pagination & {
  status?: TemplateMeta["status"];
};

export async function listTemplates(
  params: TemplateListParams = {},
): Promise<PaginatedResult<TemplateMeta>> {
  const filtered = mockTemplates.filter((template) =>
    params.status ? template.status === params.status : true
  );
  return paginateArray(filtered, params);
}
