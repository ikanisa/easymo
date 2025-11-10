import { useMemo } from "react";
import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { insurancePolicySchema, type InsurancePolicy } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export type InsurancePolicyParams = Pagination & {
  quoteId?: string;
  status?: string;
};

const listResponseSchema = z.object({
  data: z.array(insurancePolicySchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

const ROOT_KEY = ["insurance", "policies"] as const;

const serializeParams = (params: InsurancePolicyParams = {}): InsurancePolicyParams => ({
  limit: params.limit ?? 50,
  offset: params.offset ?? 0,
  quoteId: params.quoteId,
  status: params.status,
});

export const insurancePolicyKeys = {
  all: ROOT_KEY,
  list: (params: InsurancePolicyParams = { limit: 50 }) => [
    ...ROOT_KEY,
    { params: serializeParams(params) },
  ] as const,
} as const;

function buildSearchParams(params: InsurancePolicyParams = { limit: 50 }) {
  const searchParams = new URLSearchParams();
  const normalized = serializeParams(params);
  if (normalized.limit !== undefined) searchParams.set("limit", String(normalized.limit));
  if (normalized.offset !== undefined) searchParams.set("offset", String(normalized.offset));
  if (normalized.quoteId) searchParams.set("quoteId", normalized.quoteId);
  if (normalized.status) searchParams.set("status", normalized.status);
  return searchParams;
}

export type InsurancePolicyResult = PaginatedResult<InsurancePolicy> & { disabled?: boolean };

export async function fetchInsurancePolicies(
  params: InsurancePolicyParams = { limit: 50 },
): Promise<InsurancePolicyResult> {
  const response = await apiFetch<z.infer<typeof listResponseSchema>>(
    `${getAdminApiPath("insurance", "policies")}?${buildSearchParams(params).toString()}`,
  );
  const parsed = listResponseSchema.parse(response);
  return {
    data: parsed.data,
    total: parsed.total,
    hasMore:
      parsed.hasMore ?? ((params.offset ?? 0) + parsed.data.length < parsed.total),
    disabled: parsed.disabled,
  };
}

export function useInsurancePoliciesQuery(
  params: InsurancePolicyParams = { limit: 50 },
  options?: UseQueryOptions<InsurancePolicyResult, unknown, InsurancePolicyResult>,
) {
  const serialized = useMemo(() => serializeParams(params), [params]);
  return useQuery({
    queryKey: insurancePolicyKeys.list(serialized),
    queryFn: () => fetchInsurancePolicies(serialized),
    ...options,
  });
}
