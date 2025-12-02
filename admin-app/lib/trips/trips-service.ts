import { apiClient } from "@/lib/api/client";
import { callAdminFunction } from "@/lib/server/functions-client";
import { paginateArray, type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";

const isServer = typeof window === "undefined";

export type TripRow = Record<string, unknown>;

export async function listTrips(params: { search?: string } & Pagination = {}): Promise<PaginatedResult<TripRow>> {
  if (!isServer) {
    // Client → call our API
    const search = new URLSearchParams();
    if (params.search) search.set("search", params.search);
    if (typeof params.offset === "number") search.set("offset", String(params.offset));
    if (typeof params.limit === "number") search.set("limit", String(params.limit));

    const query = search.toString();
    return apiClient.fetch<PaginatedResult<TripRow>>(`trips${query ? `?${query}` : ""}`);
  }

  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    // Fallback to Edge Function
    const json = await callAdminFunction<{ trips: TripRow[] }>("admin-trips");
    const rows = Array.isArray(json?.trips) ? json.trips : [];
    // Sort by created_at descending (most recent first)
    const sorted = rows.sort((a: TripRow, b: TripRow) => {
      const dateA = a?.created_at ? new Date(a.created_at as string).getTime() : 0;
      const dateB = b?.created_at ? new Date(b.created_at as string).getTime() : 0;
      return dateB - dateA;
    });
    const filtered = sorted.filter((row: TripRow) => params.search ? matchesSearch(`${row?.id ?? ""} ${row?.creator_user_id ?? ""} ${row?.vehicle_type ?? ""}`, params.search!) : true);
    return paginateArray(filtered, params);
  }

  const query = adminClient
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);
  if (params.search) query.ilike("id", `%${params.search}%`);
  const { data, error, count } = await query;
  if (error || !data) throw new Error(`trips_db_failed:${error?.message ?? "no_data"}`);
  return {
    data: data as TripRow[],
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}
