import type { Campaign } from "@/lib/schemas";
import type {
  PaginatedResult,
  Pagination,
} from "@/lib/shared/pagination";
import {
  listCampaigns as listCampaignsFromService,
  type CampaignListParams,
} from "@/lib/campaigns/campaigns-service";

export type { PaginatedResult, Pagination };
export type { CampaignListParams };

export async function listCampaigns(
  params: CampaignListParams = {},
): Promise<PaginatedResult<Campaign>> {
  return listCampaignsFromService(params);
}
