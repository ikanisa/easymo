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
  type CampaignListParams,
} from "@/lib/campaigns/campaigns-service";

export type { PaginatedResult, Pagination };
export type { VoucherListParams };
export type { CampaignListParams };

export async function listVouchers(
  params: VoucherListParams = {},
): Promise<PaginatedResult<Voucher>> {
  return listVouchersFromService(params);
}

export async function listCampaigns(
  params: CampaignListParams = {},
): Promise<PaginatedResult<Campaign>> {
  return listCampaignsFromService(params);
}
