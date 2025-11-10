import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { listShops, type ShopListParams } from "@/lib/shops/shops-service";
import type { Shop } from "@/lib/shops/types";
import type { PaginatedResult } from "@/lib/shared/pagination";

export type ShopsQueryParams = ShopListParams;

const shopsKey = (params: ShopsQueryParams) => ["shops", params] satisfies QueryKey;

export function fetchShops(params: ShopsQueryParams = {}): Promise<PaginatedResult<Shop>> {
  return listShops(params);
}

export function useShopsQuery(
  params: ShopsQueryParams = {},
  options?: UseQueryOptions<PaginatedResult<Shop>, unknown, PaginatedResult<Shop>>,
) {
  return useQuery({
    queryKey: shopsKey(params),
    queryFn: () => fetchShops(params),
    ...options,
  });
}

export const shopsQueryKeys = {
  list: (params: ShopsQueryParams = {}) => shopsKey(params),
} as const;
