import { shouldUseMocks } from "@/lib/runtime-config";
import { getAdminApiPath } from "@/lib/routes";
import { paginateArray, type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";
import { callAdminFunction } from "@/lib/server/functions-client";
import { getAdminApiRoutePath } from "@/lib/routes";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type SubscriptionRow = Record<string, unknown>;

export async function listSubscriptions(params: { search?: string } & Pagination = {}): Promise<PaginatedResult<SubscriptionRow>> {
  if (!isServer) {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.offset !== undefined) sp.set("offset", String(params.offset));
    if (params.limit !== undefined) sp.set("limit", String(params.limit));
    const res = await fetch(`${getAdminApiRoutePath("subscriptions")}?${sp.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("subscriptions_api_failed");
    return await res.json();
  }

  if (useMocks) {
    return paginateArray([], params);
  }

  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    const json = await callAdminFunction<{ subscriptions: SubscriptionRow[] }>("admin-subscriptions");
    const rows = Array.isArray(json?.subscriptions) ? json.subscriptions : [];
    const filtered = rows.filter((row: any) => params.search ? matchesSearch(`${row?.user_id ?? ""} ${row?.txn_id ?? ""} ${row?.status ?? ""}`, params.search!) : true);
    return paginateArray(filtered, params);
  }

  const query = adminClient
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);
  if (params.search) query.or(`user_id.ilike.%${params.search}%,txn_id.ilike.%${params.search}%`);
  const { data, error, count } = await query;
  if (error || !data) throw new Error(`subscriptions_db_failed:${error?.message ?? "no_data"}`);
  return {
    data: data as SubscriptionRow[],
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}

