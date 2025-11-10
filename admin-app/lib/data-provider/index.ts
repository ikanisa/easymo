import type { Campaign } from "@/lib/schemas";
import type {
  PaginatedResult,
  Pagination,
} from "@/lib/shared/pagination";
import { mockCampaigns } from "@/lib/mock-data";
import { paginateArray } from "@/lib/shared/pagination";

export type { PaginatedResult, Pagination };

export interface CampaignListParams {
  offset?: number;
  limit?: number;
  status?: string;
}

export async function listCampaigns(
  params: CampaignListParams = {},
): Promise<PaginatedResult<Campaign>> {
  // Use mock data until campaigns service is implemented
  return paginateArray(mockCampaigns, {
    offset: params.offset ?? 0,
    limit: params.limit ?? 20,
  });
}
