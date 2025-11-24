import type { SupabaseClient } from "../deps.ts";

function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  const message = String((error as { message?: unknown }).message).toLowerCase();
  return message.includes("permission denied") || message.includes("row level security");
}

export async function createBusiness(
  client: SupabaseClient,
  payload: {
    owner: string;
    name: string;
    description?: string;
    catalog_url?: string;
    category?: string | null;
    lat: number;
    lng: number;
    tags?: string[];
  },
): Promise<void> {
  let categoryId: number | null = null;
  const categorySlug = payload.category ?? "shops";
  if (categorySlug) {
    const { data: categoryRow, error: categoryError } = await client
      .from("marketplace_categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (categoryError) throw categoryError;
    categoryId = categoryRow?.id ?? null;
  }
  const { error } = await client.from("business").insert({
    owner_whatsapp: payload.owner,
    name: payload.name,
    description: payload.description ?? null,
    catalog_url: payload.catalog_url ?? null,
    category_id: categoryId,
    lat: payload.lat,
    lng: payload.lng,
    is_active: true,
    tags: payload.tags && payload.tags.length ? payload.tags : [],
  });
  if (error) throw error;
}

export async function listBusinesses(
  client: SupabaseClient,
  coords: { lat: number; lng: number },
  category: string,
  limit = 10,
) {
  const safeCategory = category && category.length ? category : null;
  const primary = await client.rpc("nearby_businesses_v2", {
    _lat: coords.lat,
    _lng: coords.lng,
    _viewer: "",
    _category_slug: safeCategory,
    _limit: limit,
  });
  if (!primary.error) {
    return primary.data ?? [];
  }

  if (isPermissionDenied(primary.error)) {
    throw primary.error;
  }

  console.error("marketplace.nearby_v2_fail", primary.error);

  const fallbackPayload = {
    _lat: coords.lat,
    _lng: coords.lng,
    _viewer: "",
    _limit: limit,
  };

  if (safeCategory) {
    const withCategory = await client.rpc("nearby_businesses", {
      ...fallbackPayload,
      _category: safeCategory,
    });
    if (!withCategory.error) {
      return withCategory.data ?? [];
    }
    if (isPermissionDenied(withCategory.error)) {
      throw withCategory.error;
    }
    // if PostgREST rejects _category the next call omits it
    console.error(
      "marketplace.nearby_fallback_with_category_fail",
      withCategory.error,
    );
  }

  const withoutCategory = await client.rpc(
    "nearby_businesses",
    fallbackPayload,
  );
  if (withoutCategory.error) {
    if (isPermissionDenied(withoutCategory.error)) {
      throw withoutCategory.error;
    }
    throw withoutCategory.error;
  }
  return withoutCategory.data ?? [];
}
