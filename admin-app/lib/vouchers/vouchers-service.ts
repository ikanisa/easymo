import { z } from "zod";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockVouchers } from "@/lib/mock-data";
import { type Voucher, voucherSchema } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type VoucherListParams = Pagination & {
  status?: Voucher["status"];
  search?: string;
};

export async function listVouchers(
  params: VoucherListParams = {},
): Promise<PaginatedResult<Voucher>> {
  if (!isServer) {
    if (useMocks) {
      const filtered = filterVouchers(mockVouchers, params);
      return paginateArray(filtered, params);
    }

    try {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set("status", params.status);
      if (params.search) searchParams.set("search", params.search);
      if (params.offset !== undefined) {
        searchParams.set("offset", String(params.offset));
      }
      if (params.limit !== undefined) {
        searchParams.set("limit", String(params.limit));
      }

      const response = await fetch(`/api/vouchers?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch vouchers from API");
      }
      const json = await response.json();
      return z
        .object({
          data: z.array(voucherSchema),
          total: z.number(),
          hasMore: z.boolean(),
        })
        .parse(json);
    } catch (error) {
      console.error("Client vouchers fetch failed", error);
      const filtered = filterVouchers(mockVouchers, params);
      return paginateArray(filtered, params);
    }
  }

  if (useMocks) {
    const filtered = filterVouchers(mockVouchers, params);
    return paginateArray(filtered, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    const filtered = filterVouchers(mockVouchers, params);
    return paginateArray(filtered, params);
  }

  const query = adminClient
    .from("vouchers")
    .select(
      `id, user_id, amount, currency, status, campaign_id, station_scope, issued_at, redeemed_at, expires_at,
       users(display_name, msisdn)`,
      { count: "exact" },
    )
    .order("issued_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  if (params.status) {
    query.eq("status", params.status);
  }
  if (params.search) {
    query.or(
      `id.ilike.%${params.search}%, users.msisdn.ilike.%${params.search}%`,
    );
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch vouchers from Supabase", error);
    const fallback = paginateArray(mockVouchers, params);
    return fallback;
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      userName:
        (item.users as { display_name?: string } | null)?.display_name ??
          undefined,
      msisdn: (item.users as { msisdn?: string } | null)?.msisdn ?? "—",
      code: (item as Record<string, unknown>).code5 as string | undefined,
      amount: item.amount ?? 0,
      currency: item.currency ?? "RWF",
      status: item.status as Voucher["status"],
      campaignId: item.campaign_id,
      stationScope: item.station_scope,
      issuedAt: item.issued_at,
      redeemedAt: item.redeemed_at,
      expiresAt: item.expires_at,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

function filterVouchers(
  vouchers: Voucher[],
  params: VoucherListParams,
): Voucher[] {
  return vouchers.filter((voucher) => {
    const statusMatch = params.status ? voucher.status === params.status : true;
    const searchMatch = params.search
      ? matchesSearch(
        `${voucher.userName ?? ""} ${voucher.msisdn} ${voucher.id}`,
        params.search,
      )
      : true;
    return statusMatch && searchMatch;
  });
}
