import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockShops } from "@/lib/mock-data";
import { paginateArray, type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type { CreateShopPayload, Shop } from "@/lib/shops/types";

export type ShopListParams = Pagination & {
  search?: string;
  verified?: boolean;
};

const useMocks = shouldUseMocks();

export async function listShops(params: ShopListParams = {}): Promise<PaginatedResult<Shop>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;

  if (useMocks) {
    let filtered = mockShops;
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filtered = filtered.filter((shop) =>
        [shop.name, shop.description, shop.businessLocation ?? ""].some((value) =>
          value.toLowerCase().includes(searchLower),
        ) ||
        shop.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }
    if (params.verified !== undefined) {
      filtered = filtered.filter((shop) => shop.verified === params.verified);
    }
    return paginateArray(filtered, { offset, limit });
  }

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
  if (useMocks) {
    const newShop: Shop = {
      id: `mock-shop-${Math.random().toString(36).slice(2, 8)}`,
      name: payload.name,
      description: payload.description,
      tags: payload.tags,
      whatsappCatalogUrl: payload.whatsappCatalogUrl ?? null,
      phone: payload.phone ?? null,
      openingHours: payload.openingHours ?? null,
      verified: false,
      status: "active",
      rating: null,
      totalReviews: 0,
      businessLocation: payload.businessLocation,
      coordinates: payload.coordinates ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockShops.unshift(newShop);
    return newShop;
  }

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
