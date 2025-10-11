import { mockFlows } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { FlowMeta } from "@/lib/schemas";

export type FlowListParams = Pagination & {
  status?: FlowMeta["status"];
};

export async function listFlows(
  params: FlowListParams = {},
): Promise<PaginatedResult<FlowMeta>> {
  const filtered = mockFlows.filter((flow) =>
    params.status ? flow.status === params.status : true
  );
  return paginateArray(filtered, params);
}
