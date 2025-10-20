import { z } from "zod";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockUsers } from "@/lib/mock-data";
import { type User, userSchema } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export async function listUsers(
  params: { search?: string } & Pagination = {},
): Promise<PaginatedResult<User>> {
  if (!isServer) {
    if (useMocks) {
      const filtered = mockUsers.filter((user) =>
        params.search
          ? matchesSearch(
            `${user.displayName ?? ""} ${user.msisdn}`,
            params.search,
          )
          : true
      );
      return paginateArray(filtered, params);
    }

    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set("search", params.search);
    if (params.offset !== undefined) {
      searchParams.set("offset", String(params.offset));
    }
    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }

    const response = await fetch(`/api/users?${searchParams.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Failed to fetch users from API");
    }
    const json = await response.json();
    return z
      .object({
        data: z.array(userSchema),
        total: z.number(),
        hasMore: z.boolean(),
      })
      .parse(json);
  }

  if (useMocks) {
    const filtered = mockUsers.filter((user) =>
      params.search
        ? matchesSearch(
          `${user.displayName ?? ""} ${user.msisdn}`,
          params.search,
        )
        : true
    );
    return paginateArray(filtered, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Supabase admin client is not configured.");
  }

  const query = adminClient
    .from("users")
    .select(
      `id, msisdn, display_name, locale, roles, status, created_at, last_seen_at`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  if (params.search) {
    query.ilike("msisdn", `%${params.search}%`);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    throw new Error(
      `Failed to fetch users from Supabase: ${error?.message ?? "no data returned"}`,
    );
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      msisdn: item.msisdn,
      displayName: item.display_name,
      locale: item.locale ?? "rw-RW",
      roles: item.roles ?? [],
      status: item.status ?? "active",
      createdAt: item.created_at,
      lastSeenAt: item.last_seen_at,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}
