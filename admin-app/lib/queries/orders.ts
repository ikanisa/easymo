import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { Order } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";
import { listOrders, type OrderListParams } from "@/lib/orders/orders-service";

export type OrdersQueryParams = OrderListParams;

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
