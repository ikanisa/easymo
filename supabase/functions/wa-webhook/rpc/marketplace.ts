import type { SupabaseClient } from "../deps.ts";

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
  },
): Promise<void> {
  let categoryId: number | null = null;
  if (payload.category) {
    const { data: categoryRow, error: categoryError } = await client
      .from("marketplace_categories")
      .select("id")
      .eq("slug", payload.category)
      .maybeSingle();
    if (categoryError) throw categoryError;
    categoryId = categoryRow?.id ?? null;
  }
  const { error } = await client.from("businesses").insert({
    owner_whatsapp: payload.owner,
    name: payload.name,
    description: payload.description ?? null,
    catalog_url: payload.catalog_url ?? null,
    category_id: categoryId,
    lat: payload.lat,
    lng: payload.lng,
    is_active: true,
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
    throw withoutCategory.error;
  }
  return withoutCategory.data ?? [];
}
