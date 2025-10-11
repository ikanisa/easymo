import { shouldUseMocks } from "@/lib/runtime-config";
import { mockInsuranceQuotes } from "@/lib/mock-data";
import type { InsuranceQuote } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type InsuranceQuoteListParams = Pagination & {
  status?: InsuranceQuote["status"];
};

export async function listInsuranceQuotes(
  params: InsuranceQuoteListParams = {},
): Promise<PaginatedResult<InsuranceQuote>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 25;

  if (!isServer) {
    // CSR still relies on mocks until API pagination is wired.
    return paginateArray(filterQuotes(mockInsuranceQuotes, params), {
      offset,
      limit,
    });
  }

  if (useMocks) {
    return paginateArray(filterQuotes(mockInsuranceQuotes, params), {
      offset,
      limit,
    });
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(filterQuotes(mockInsuranceQuotes, params), {
      offset,
      limit,
    });
  }

  const query = adminClient
    .from("insurance_quotes")
    .select(
      "id, user_id, status, premium, insurer, uploaded_docs, created_at, updated_at, reviewer_comment",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query.eq("status", params.status);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch insurance quotes from Supabase", error);
    return paginateArray(filterQuotes(mockInsuranceQuotes, params), {
      offset,
      limit,
    });
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      status: item.status as InsuranceQuote["status"],
      premium: item.premium,
      insurer: item.insurer,
      uploadedDocs: item.uploaded_docs ?? [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      reviewerComment: item.reviewer_comment ?? null,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

function filterQuotes(
  quotes: InsuranceQuote[],
  params: InsuranceQuoteListParams,
): InsuranceQuote[] {
  if (!params.status) return quotes;
  return quotes.filter((quote) => quote.status === params.status);
}
