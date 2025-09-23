import type { SupabaseClient } from "../deps.ts";

export async function createBusiness(
  client: SupabaseClient,
  payload: {
    owner: string;
    name: string;
    description?: string;
    catalog_url?: string;
    lat: number;
    lng: number;
  },
): Promise<void> {
  const { error } = await client.from("businesses").insert({
    owner_whatsapp: payload.owner,
    name: payload.name,
    description: payload.description ?? null,
    catalog_url: payload.catalog_url ?? null,
    location: `SRID=4326;POINT(${payload.lng} ${payload.lat})`,
    is_active: true,
  });
  if (error) throw error;
}

export async function listBusinesses(
  client: SupabaseClient,
  coords: { lat: number; lng: number },
  limit = 10,
) {
  const { data, error } = await client.rpc("nearby_businesses", {
    _lat: coords.lat,
    _lng: coords.lng,
    _viewer: "",
    _limit: limit,
  });
  if (error) throw error;
  return data ?? [];
}
