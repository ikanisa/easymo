import { useMemo } from "react";
import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { insurancePaymentSchema, type InsurancePayment } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export type InsurancePaymentParams = Pagination & {
  quoteId?: string;
  intentId?: string;
  status?: string;
};

const listResponseSchema = z.object({
  data: z.array(insurancePaymentSchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

const ROOT_KEY = ["insurance", "payments"] as const;

const serializeParams = (params: InsurancePaymentParams = {}): InsurancePaymentParams => ({
  limit: params.limit ?? 50,
  offset: params.offset ?? 0,
  quoteId: params.quoteId,
  intentId: params.intentId,
  status: params.status,
});

export const insurancePaymentKeys = {
  all: ROOT_KEY,
  list: (params: InsurancePaymentParams = { limit: 50 }) => [
    ...ROOT_KEY,
    { params: serializeParams(params) },
  ] as const,
} as const;

function buildSearchParams(params: InsurancePaymentParams = { limit: 50 }) {
  const searchParams = new URLSearchParams();
  const normalized = serializeParams(params);
  if (normalized.limit !== undefined) searchParams.set("limit", String(normalized.limit));
  if (normalized.offset !== undefined) searchParams.set("offset", String(normalized.offset));
  if (normalized.quoteId) searchParams.set("quoteId", normalized.quoteId);
  if (normalized.intentId) searchParams.set("intentId", normalized.intentId);
  if (normalized.status) searchParams.set("status", normalized.status);
  return searchParams;
}

export type InsurancePaymentResult = PaginatedResult<InsurancePayment> & { disabled?: boolean };

export async function fetchInsurancePayments(
  params: InsurancePaymentParams = { limit: 50 },
): Promise<InsurancePaymentResult> {
  const response = await apiFetch<z.infer<typeof listResponseSchema>>(
    `${getAdminApiPath("insurance", "payments")}?${buildSearchParams(params).toString()}`,
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

export function useInsurancePaymentsQuery(
  params: InsurancePaymentParams = { limit: 50 },
  options?: UseQueryOptions<InsurancePaymentResult, unknown, InsurancePaymentResult>,
) {
  const serialized = useMemo(() => serializeParams(params), [params]);
  return useQuery({
    queryKey: insurancePaymentKeys.list(serialized),
    queryFn: () => fetchInsurancePayments(serialized),
    ...options,
  });
}
