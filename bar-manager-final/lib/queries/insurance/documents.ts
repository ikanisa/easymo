import { useQuery,UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type InsuranceDocument,insuranceDocumentSchema } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export type InsuranceDocumentParams = Pagination & {
  intentId?: string;
  ocrState?: string;
};

const listResponseSchema = z.object({
  data: z.array(insuranceDocumentSchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
});

const ROOT_KEY = ["insurance", "documents"] as const;

const serializeParams = (params: InsuranceDocumentParams = {}): InsuranceDocumentParams => ({
  limit: params.limit ?? 50,
  offset: params.offset ?? 0,
  intentId: params.intentId,
  ocrState: params.ocrState,
});

export const insuranceDocumentKeys = {
  all: ROOT_KEY,
  list: (params: InsuranceDocumentParams = { limit: 50 }) => [
    ...ROOT_KEY,
    { params: serializeParams(params) },
  ] as const,
} as const;

function buildSearchParams(params: InsuranceDocumentParams = { limit: 50 }) {
  const searchParams = new URLSearchParams();
  const normalized = serializeParams(params);
  if (normalized.limit !== undefined) searchParams.set("limit", String(normalized.limit));
  if (normalized.offset !== undefined) searchParams.set("offset", String(normalized.offset));
  if (normalized.intentId) searchParams.set("intentId", normalized.intentId);
  if (normalized.ocrState) searchParams.set("ocrState", normalized.ocrState);
  return searchParams;
}

export async function fetchInsuranceDocuments(
  params: InsuranceDocumentParams = { limit: 50 },
): Promise<PaginatedResult<InsuranceDocument>> {
  const response = await apiFetch<z.infer<typeof listResponseSchema>>(
    `${getAdminApiPath("insurance", "documents")}?${buildSearchParams(params).toString()}`,
  );
  const parsed = listResponseSchema.parse(response);
  return {
    data: parsed.data,
    total: parsed.total,
    hasMore:
      parsed.hasMore ?? ((params.offset ?? 0) + parsed.data.length < parsed.total),
  };
}

export function useInsuranceDocumentsQuery(
  params: InsuranceDocumentParams = { limit: 50 },
  options?: UseQueryOptions<
    PaginatedResult<InsuranceDocument>,
    unknown,
    PaginatedResult<InsuranceDocument>
  >,
) {
  const serialized = useMemo(() => serializeParams(params), [params]);
  return useQuery({
    queryKey: insuranceDocumentKeys.list(serialized),
    queryFn: () => fetchInsuranceDocuments(serialized),
    ...options,
  });
}
