import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/data-provider";
import { apiFetch } from "@/lib/api/client";
import { mockOrders } from "@/lib/mock-data";
import type { Order } from "@/lib/schemas";

export type OrdersQueryParams = {
  status?: string;
  barId?: string;
  limit?: number;
  offset?: number;
};

const ordersKey = (params: OrdersQueryParams) =>
  ["orders", params] satisfies QueryKey;

export async function fetchOrders(
  params: OrdersQueryParams = { limit: 200 },
): Promise<PaginatedResult<Order>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.status) searchParams.set('status', params.status);
  if (params.barId) searchParams.set('barId', params.barId);

  const response = await apiFetch<{ data: Order[]; total: number; hasMore?: boolean }>(`/api/orders?${searchParams.toString()}`);
  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total)
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockOrders.length;
  const slice = mockOrders.slice(offset, offset + limit);
  return {
    data: slice,
    total: mockOrders.length,
    hasMore: offset + slice.length < mockOrders.length
  };
}

export function useOrdersQuery(
  params: OrdersQueryParams = { limit: 200 },
  options?: UseQueryOptions<
    PaginatedResult<Order>,
    unknown,
    PaginatedResult<Order>
  >,
) {
  return useQuery({
    queryKey: ordersKey(params),
    queryFn: () => fetchOrders(params),
    ...options,
  });
}

export const ordersQueryKeys = {
  list: (params: OrdersQueryParams = { limit: 200 }) => ordersKey(params),
} as const;
