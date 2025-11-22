import { useMutation, UseMutationOptions, useQuery, useQueryClient,UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type InsuranceRequest,insuranceRequestSchema } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export type InsuranceRequestParams = Pagination & {
  status?: string;
  search?: string;
};

const listResponseSchema = z.object({
  data: z.array(insuranceRequestSchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
});

const createResponseSchema = z.object({
  data: insuranceRequestSchema,
});

const ROOT_KEY = ["insurance", "requests"] as const;

const serializeParams = (params: InsuranceRequestParams = {}): InsuranceRequestParams => ({
  limit: params.limit ?? 50,
  offset: params.offset ?? 0,
  status: params.status,
  search: params.search,
});

export const insuranceRequestKeys = {
  all: ROOT_KEY,
  list: (params: InsuranceRequestParams = { limit: 50 }) => [
    ...ROOT_KEY,
    { params: serializeParams(params) },
  ] as const,
} as const;

function buildSearchParams(params: InsuranceRequestParams = { limit: 50 }) {
  const searchParams = new URLSearchParams();
  const normalized = serializeParams(params);
  if (normalized.limit !== undefined) searchParams.set("limit", String(normalized.limit));
  if (normalized.offset !== undefined) searchParams.set("offset", String(normalized.offset));
  if (normalized.status) searchParams.set("status", normalized.status);
  if (normalized.search) searchParams.set("search", normalized.search);
  return searchParams;
}

export async function fetchInsuranceRequests(
  params: InsuranceRequestParams = { limit: 50 },
): Promise<PaginatedResult<InsuranceRequest>> {
  const response = await apiFetch<z.infer<typeof listResponseSchema>>(
    `${getAdminApiPath("insurance", "requests")}?${buildSearchParams(params).toString()}`,
  );
  const parsed = listResponseSchema.parse(response);
  return {
    data: parsed.data,
    total: parsed.total,
    hasMore:
      parsed.hasMore ?? ((params.offset ?? 0) + parsed.data.length < parsed.total),
  };
}

export function useInsuranceRequestsQuery(
  params: InsuranceRequestParams = { limit: 50 },
  options?: UseQueryOptions<
    PaginatedResult<InsuranceRequest>,
    unknown,
    PaginatedResult<InsuranceRequest>
  >,
) {
  const serialized = useMemo(() => serializeParams(params), [params]);
  return useQuery({
    queryKey: insuranceRequestKeys.list(serialized),
    queryFn: () => fetchInsuranceRequests(serialized),
    ...options,
  });
}

const createRequestSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  status: z.string().optional(),
  vehicleType: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  insurerPreference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function useCreateInsuranceRequestMutation(
  params: InsuranceRequestParams = { limit: 50 },
  options?: UseMutationOptions<z.infer<typeof createResponseSchema>, Error, z.infer<typeof createRequestSchema>>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...insuranceRequestKeys.list(params), "create"],
    mutationFn: async (payload: z.infer<typeof createRequestSchema>) => {
      const response = await apiFetch(
        getAdminApiPath("insurance", "requests"),
        {
          method: "POST",
          body: payload,
        },
      );
      return createResponseSchema.parse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceRequestKeys.list(params) });
    },
    ...options,
  });
}
