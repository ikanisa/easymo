import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";

import type { PaginatedResult } from "@/lib/shared/pagination";
import { listShops, type ShopListParams } from "@/lib/shops/shops-service";
import type { Shop } from "@/lib/shops/types";

export type ShopsQueryParams = ShopListParams;

const shopsKey = (params: ShopsQueryParams) => ["shops", params] satisfies QueryKey;

export function fetchShops(params: ShopsQueryParams = {}): Promise<PaginatedResult<Shop>> {
  return listShops(params);
}

type ShopsQueryOptions = Omit<
  UseQueryOptions<PaginatedResult<Shop>, unknown, PaginatedResult<Shop>>,
  "queryKey" | "queryFn"
>;

export function useShopsQuery(
  params: ShopsQueryParams = {},
  options?: ShopsQueryOptions,
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
