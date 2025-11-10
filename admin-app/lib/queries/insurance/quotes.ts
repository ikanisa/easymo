import { useEffect, useMemo } from "react";
import {
  QueryKey,
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import {
  insuranceQuoteSchema,
  type InsuranceQuote,
} from "@/lib/schemas";
import {
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import { getSupabaseClient } from "@/lib/supabase-client";

export type InsuranceQueryParams = Pagination & {
  status?: string;
  search?: string;
  intentId?: string;
};

const listResponseSchema = z.object({
  data: z.array(insuranceQuoteSchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
});

const mutationResponseSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  integration: z.any().optional(),
});

const statusResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    status: z.string(),
    reviewerComment: z.string().nullable(),
    approvedAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  }),
});

const ROOT_KEY = ["insurance", "quotes"] as const;

const serializeParams = (params: InsuranceQueryParams = {}): InsuranceQueryParams => ({
  limit: params.limit ?? 100,
  offset: params.offset ?? 0,
  status: params.status,
  search: params.search,
  intentId: params.intentId,
});

const listKey = (params: InsuranceQueryParams): QueryKey => [
  ...ROOT_KEY,
  { params: serializeParams(params) },
];

export const insuranceQueryKeys = {
  all: ROOT_KEY,
  list: (params: InsuranceQueryParams = { limit: 100 }) => listKey(params),
} as const;

function buildSearchParams(params: InsuranceQueryParams = { limit: 100 }): URLSearchParams {
  const searchParams = new URLSearchParams();
  const normalized = serializeParams(params);
  if (normalized.limit !== undefined) searchParams.set("limit", String(normalized.limit));
  if (normalized.offset !== undefined) searchParams.set("offset", String(normalized.offset));
  if (normalized.status) searchParams.set("status", normalized.status);
  if (normalized.search) searchParams.set("search", normalized.search);
  if (normalized.intentId) searchParams.set("intentId", normalized.intentId);
  return searchParams;
}

export async function fetchInsuranceQuotes(
  params: InsuranceQueryParams = { limit: 100 },
): Promise<PaginatedResult<InsuranceQuote>> {
  const searchParams = buildSearchParams(params);
  const response = await apiFetch<z.infer<typeof listResponseSchema>>(
    `${getAdminApiPath("insurance", "quotes")}?${searchParams.toString()}`,
  );
  const parsed = listResponseSchema.parse(response);
  return {
    data: parsed.data,
    total: parsed.total,
    hasMore:
      parsed.hasMore ?? ((params.offset ?? 0) + parsed.data.length < parsed.total),
  };
}

export function useInsuranceQuotesQuery(
  params: InsuranceQueryParams = { limit: 100 },
  options?: UseQueryOptions<
    PaginatedResult<InsuranceQuote>,
    unknown,
    PaginatedResult<InsuranceQuote>
  >,
) {
  const queryParams = useMemo(() => serializeParams(params), [params]);
  return useQuery({
    queryKey: insuranceQueryKeys.list(queryParams),
    queryFn: () => fetchInsuranceQuotes(queryParams),
    ...options,
  });
}

export function useInsuranceQuotesRealtime(params: InsuranceQueryParams = { limit: 100 }) {
  const queryClient = useQueryClient();
  const serialized = useMemo(() => serializeParams(params), [params]);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel("admin-insurance-quotes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insurance_quotes" },
        () => {
          queryClient.invalidateQueries({ queryKey: insuranceQueryKeys.list(serialized) });
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [queryClient, serialized]);
}

export function useApproveInsuranceQuoteMutation(
  params: InsuranceQueryParams = { limit: 100 },
  options?: UseMutationOptions<z.infer<typeof mutationResponseSchema>, Error, string>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...insuranceQueryKeys.list(params), "approve"],
    mutationFn: async (quoteId: string) => {
      const response = await apiFetch(
        getAdminApiPath("insurance", "approve"),
        {
          method: "POST",
          body: { quoteId },
        },
      );
      return mutationResponseSchema.parse(response);
    },
    onMutate: async (quoteId: string) => {
      await queryClient.cancelQueries({ queryKey: insuranceQueryKeys.list(params) });
      const previous = queryClient.getQueryData<PaginatedResult<InsuranceQuote>>(
        insuranceQueryKeys.list(params),
      );
      if (previous) {
        queryClient.setQueryData<PaginatedResult<InsuranceQuote>>(
          insuranceQueryKeys.list(params),
          {
            ...previous,
            data: previous.data.map((quote) =>
              quote.id === quoteId
                ? { ...quote, status: "approved", approvedAt: new Date().toISOString() }
                : quote,
            ),
          },
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          insuranceQueryKeys.list(params),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: insuranceQueryKeys.list(params) });
    },
    ...options,
  });
}

export function useRequestChangesMutation(
  params: InsuranceQueryParams = { limit: 100 },
  options?: UseMutationOptions<z.infer<typeof mutationResponseSchema>, Error, { quoteId: string; comment: string }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...insuranceQueryKeys.list(params), "request-changes"],
    mutationFn: async ({ quoteId, comment }) => {
      const response = await apiFetch(
        getAdminApiPath("insurance", "request-changes"),
        {
          method: "POST",
          body: { quoteId, comment },
        },
      );
      return mutationResponseSchema.parse(response);
    },
    onMutate: async ({ quoteId, comment }) => {
      await queryClient.cancelQueries({ queryKey: insuranceQueryKeys.list(params) });
      const previous = queryClient.getQueryData<PaginatedResult<InsuranceQuote>>(
        insuranceQueryKeys.list(params),
      );
      if (previous) {
        queryClient.setQueryData<PaginatedResult<InsuranceQuote>>(
          insuranceQueryKeys.list(params),
          {
            ...previous,
            data: previous.data.map((quote) =>
              quote.id === quoteId
                ? { ...quote, status: "needs_changes", reviewerComment: comment }
                : quote,
            ),
          },
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          insuranceQueryKeys.list(params),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: insuranceQueryKeys.list(params) });
    },
    ...options,
  });
}

export function useUpdateInsuranceQuoteStatusMutation(
  params: InsuranceQueryParams = { limit: 100 },
  options?: UseMutationOptions<z.infer<typeof statusResponseSchema>, Error, { quoteId: string; status: string; reviewerComment?: string | null }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...insuranceQueryKeys.list(params), "status"],
    mutationFn: async ({ quoteId, status, reviewerComment }) => {
      const response = await apiFetch(
        getAdminApiPath("insurance", "quotes", quoteId, "status"),
        {
          method: "PATCH",
          body: { status, reviewerComment: reviewerComment ?? null },
        },
      );
      return statusResponseSchema.parse(response);
    },
    onMutate: async ({ quoteId, status, reviewerComment }) => {
      await queryClient.cancelQueries({ queryKey: insuranceQueryKeys.list(params) });
      const previous = queryClient.getQueryData<PaginatedResult<InsuranceQuote>>(
        insuranceQueryKeys.list(params),
      );
      if (previous) {
        queryClient.setQueryData<PaginatedResult<InsuranceQuote>>(
          insuranceQueryKeys.list(params),
          {
            ...previous,
            data: previous.data.map((quote) =>
              quote.id === quoteId
                ? {
                    ...quote,
                    status,
                    reviewerComment: reviewerComment ?? quote.reviewerComment ?? null,
                    approvedAt: status === "approved" ? new Date().toISOString() : quote.approvedAt ?? null,
                  }
                : quote,
            ),
          },
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          insuranceQueryKeys.list(params),
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: insuranceQueryKeys.list(params) });
    },
    ...options,
  });
}
