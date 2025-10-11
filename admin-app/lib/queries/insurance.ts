import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { InsuranceQuote } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import {
  type InsuranceQuoteListParams,
  listInsuranceQuotes,
} from "@/lib/insurance/insurance-quotes-service";

export type InsuranceQueryParams = InsuranceQuoteListParams;

const insuranceKey = (params: InsuranceQueryParams) =>
  ["insurance-quotes", params] satisfies QueryKey;

export function fetchInsuranceQuotes(
  params: InsuranceQueryParams = { limit: 100 },
): Promise<PaginatedResult<InsuranceQuote>> {
  return listInsuranceQuotes(params);
}

export function useInsuranceQuotesQuery(
  params: InsuranceQueryParams = { limit: 100 },
  options?: UseQueryOptions<
    PaginatedResult<InsuranceQuote>,
    unknown,
    PaginatedResult<InsuranceQuote>
  >,
) {
  return useQuery({
    queryKey: insuranceKey(params),
    queryFn: () => fetchInsuranceQuotes(params),
    ...options,
  });
}

export const insuranceQueryKeys = {
  list: (params: InsuranceQueryParams = { limit: 100 }) => insuranceKey(params),
} as const;
