import { shouldUseMocks } from "@/lib/runtime-config";
import { paginateArray, type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";
import { callAdminFunction } from "@/lib/server/functions-client";
import { apiClient } from "@/lib/api/client";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type TripRow = Record<string, unknown>;

export async function listTrips(params: { search?: string } & Pagination = {}): Promise<PaginatedResult<TripRow>> {
  if (!isServer) {
    // Client → call our API
    return apiClient.request("trips", {
      query: {
        search: params.search,
        offset: params.offset,
        limit: params.limit,
      },
    });
  }

  if (useMocks) {
    return paginateArray([], params);
  }

  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    // Fallback to Edge Function
    const json = await callAdminFunction<{ trips: TripRow[] }>("admin-trips");
    const rows = Array.isArray(json?.trips) ? json.trips : [];
    const filtered = rows.filter((row: any) => params.search ? matchesSearch(`${row?.id ?? ""} ${row?.creator_user_id ?? ""} ${row?.vehicle_type ?? ""}`, params.search!) : true);
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
