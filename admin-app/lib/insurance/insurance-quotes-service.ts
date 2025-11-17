import type { InsuranceQuote } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";

const isServer = typeof window === "undefined";

export type InsuranceQuoteListParams = Pagination & {
  status?: InsuranceQuote["status"];
};

export async function listInsuranceQuotes(
  params: InsuranceQuoteListParams = {},
): Promise<PaginatedResult<InsuranceQuote>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 25;

  // Always call the live admin API which aggregates required joins
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.status) searchParams.set("status", params.status);
  const url = `${getAdminApiPath("insurance", "quotes")}?${searchParams.toString()}`;

  const response = await apiFetch<{ data: InsuranceQuote[]; total: number; hasMore?: boolean }>(url);
  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}

// Filtering is provided by server route; local fallback removed
