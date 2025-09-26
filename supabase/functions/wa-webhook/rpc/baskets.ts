import type { SupabaseClient } from "../deps.ts";

export type BasketSummary = {
  id: string;
  name: string | null;
  status: string | null;
  member_count: number | null;
  balance_minor: number | null;
  currency: string | null;
};

export type DiscoverBasket = {
  id: string;
  name: string | null;
  description?: string | null;
  distance_km?: number | null;
  member_count?: number | null;
};

export type BasketDetail = {
  id: string;
  name: string | null;
  status: string | null;
  member_count: number | null;
  balance_minor?: number | null;
  goal_minor?: number | null;
  currency?: string | null;
  share_token?: string | null;
  is_owner?: boolean | null;
  owner_name?: string | null;
  owner_whatsapp?: string | null;
  last_activity?: string | null;
};

export async function listMyBaskets(
  client: SupabaseClient,
  profileId: string,
): Promise<BasketSummary[]> {
  const { data, error } = await client.rpc("basket_list_mine", {
    _profile_id: profileId,
  });
  if (error) throw error;
  return (data ?? []) as BasketSummary[];
}

export async function discoverBaskets(
  client: SupabaseClient,
  params: { profileId: string; lat: number; lng: number; limit?: number },
): Promise<DiscoverBasket[]> {
  const { data, error } = await client.rpc("basket_discover_nearby", {
    _profile_id: params.profileId,
    _lat: params.lat,
    _lng: params.lng,
    _limit: params.limit ?? 10,
  });
  if (error) throw error;
  return (data ?? []) as DiscoverBasket[];
}

export async function createBasket(
  client: SupabaseClient,
  params: {
    profileId: string;
    whatsapp: string;
    name: string;
    isPublic: boolean;
    goalMinor?: number | null;
  },
): Promise<
  { id: string | null; shareToken: string | null; qrUrl: string | null }
> {
  const { data, error } = await client.rpc("basket_create", {
    _profile_id: params.profileId,
    _whatsapp: params.whatsapp,
    _name: params.name,
    _is_public: params.isPublic,
    _goal_minor: params.goalMinor ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { id: null, shareToken: null, qrUrl: null };
  }
  return {
    id: (row.basket_id ?? row.id ?? null) as string | null,
    shareToken: (row.share_token ?? row.token ?? null) as string | null,
    qrUrl: (row.qr_url ?? row.qr ?? null) as string | null,
  };
}

export async function joinBasketByCode(
  client: SupabaseClient,
  params: { profileId: string; whatsapp: string; code: string },
): Promise<{ basketId: string; name: string | null }> {
  const { data, error } = await client.rpc("basket_join_by_code", {
    _profile_id: params.profileId,
    _whatsapp: params.whatsapp,
    _code: params.code,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.basket_id) {
    throw new Error("No basket found for that code.");
  }
  return {
    basketId: (row?.basket_id ?? row?.id) as string,
    name: (row?.basket_name ?? row?.name ?? null) as string | null,
  };
}

export async function getBasketDetail(
  client: SupabaseClient,
  params: { profileId: string; basketId: string },
): Promise<BasketDetail | null> {
  const { data, error } = await client.rpc("basket_detail", {
    _profile_id: params.profileId,
    _basket_id: params.basketId,
  });
  if (error) throw error;
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as BasketDetail;
}

export async function generateBasketQr(
  client: SupabaseClient,
  params: { profileId: string; basketId: string },
): Promise<{ qrUrl: string | null }> {
  const { data, error } = await client.rpc("basket_generate_qr", {
    _profile_id: params.profileId,
    _basket_id: params.basketId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { qrUrl: (row?.qr_url ?? row?.qr ?? null) as string | null };
}

export async function closeBasket(
  client: SupabaseClient,
  params: { profileId: string; basketId: string },
): Promise<void> {
  const { error } = await client.rpc("basket_close", {
    _profile_id: params.profileId,
    _basket_id: params.basketId,
  });
  if (error) throw error;
}

export async function leaveBasket(
  client: SupabaseClient,
  params: { profileId: string; basketId: string },
): Promise<void> {
  const { error } = await client.rpc("basket_leave", {
    _profile_id: params.profileId,
    _basket_id: params.basketId,
  });
  if (error) throw error;
}
