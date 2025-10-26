import type { Campaign, Voucher } from "@/lib/schemas";
import type {
  PaginatedResult,
  Pagination,
} from "@/lib/shared/pagination";
import {
  listVouchers as listVouchersFromService,
  type VoucherListParams,
} from "@/lib/vouchers/vouchers-service";
import {
  listCampaigns as listCampaignsFromService,
} from "@/lib/campaigns/campaigns-service";

export type { PaginatedResult, Pagination };
export type { VoucherListParams };

export type CampaignListParams = Pagination & {
  status?: Campaign["status"];
  search?: string;
};

export async function listVouchers(
  params: VoucherListParams = {},
): Promise<PaginatedResult<Voucher>> {
  return listVouchersFromService(params);
}

export async function listCampaigns(
  params: CampaignListParams = {},
): Promise<PaginatedResult<Campaign>> {
  const result = await listCampaignsFromService(params);

  if (params.status || params.search) {
    const normalizedSearch = params.search?.toLowerCase();
    const filtered = result.data.filter((campaign) => {
      const statusMatch = params.status
        ? campaign.status === params.status
        : true;
      const searchMatch = normalizedSearch
        ? `${campaign.name} ${campaign.id}`
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      return statusMatch && searchMatch;
    });

    return {
      data: filtered,
      total: filtered.length,
      hasMore: false,
    } satisfies PaginatedResult<Campaign>;
  }

  return result;
}
