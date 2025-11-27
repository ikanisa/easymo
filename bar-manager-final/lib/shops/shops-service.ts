import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type { CreateShopPayload, Shop } from "@/lib/shops/types";

export type ShopListParams = Pagination & {
  search?: string;
  verified?: boolean;
};


export async function listShops(params: ShopListParams = {}): Promise<PaginatedResult<Shop>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.verified !== undefined) searchParams.set("verified", params.verified ? "true" : "false");

  const response = await apiFetch<{ data: Shop[]; total: number; hasMore?: boolean }>(
    `${getAdminApiPath("shops")}?${searchParams.toString()}`,
  );

  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}

export async function createShop(payload: CreateShopPayload): Promise<Shop> {
  const response = await apiFetch<{ shop: Shop }>(getAdminApiPath("shops"), {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      phone: payload.phone,
      tags: payload.tags,
      businessLocation: payload.businessLocation,
      coordinates: payload.coordinates,
      whatsappCatalogUrl: payload.whatsappCatalogUrl,
      openingHours: payload.openingHours,
    }),
  });

  return response.shop;
}
