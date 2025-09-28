import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { listOrders, type PaginatedResult } from "@/lib/data-provider";
import type { Order } from "@/lib/schemas";

export type OrdersQueryParams = {
  status?: string;
  limit?: number;
  offset?: number;
};

const ordersKey = (params: OrdersQueryParams) =>
  ["orders", params] satisfies QueryKey;

export function fetchOrders(
  params: OrdersQueryParams = { limit: 200 },
): Promise<PaginatedResult<Order>> {
  return listOrders(params);
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
