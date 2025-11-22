import "server-only";

import { z } from "zod";

import { getAdminApiPath } from "@/lib/routes";
import { type User, userSchema } from "@/lib/schemas";
import { callAdminFunction } from "@/lib/server/functions-client";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";

const isServer = typeof window === "undefined";

export async function listUsers(
  params: { search?: string } & Pagination = {},
): Promise<PaginatedResult<User>> {
  if (!isServer) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set("search", params.search);
    if (params.offset !== undefined) {
      searchParams.set("offset", String(params.offset));
    }
    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }

    const response = await fetch(`${getAdminApiPath("users")}?${searchParams.toString()}`, {
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

  const { getSupabaseAdminClient } = await import("@/lib/server/supabase-admin");
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    // Fallback: use Edge Function admin-users via admin token if available
    try {
      const json = await callAdminFunction<{ users: Array<Record<string, unknown>> }>("admin-users");
      const rows = Array.isArray(json?.users) ? json.users : [];
      const mapped = rows.map((row: any) => ({
        id: String(row.user_id ?? row.id ?? ""),
        msisdn: String(row.whatsapp_e164 ?? row.msisdn ?? ""),
        displayName: row.display_name ?? row.user_name ?? undefined,
        locale: (row.locale as string | undefined) ?? "rw-RW",
        roles: Array.isArray(row.roles) ? row.roles : [],
        status: (row.subscription_status as any) ?? "active",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        lastSeenAt: (row.last_seen_at as string | null | undefined) ?? null,
      }));
      return paginateArray(
        mapped.filter((u) => params.search ? matchesSearch(`${u.displayName ?? ""} ${u.msisdn}`, params.search!) : true),
        params,
      );
    } catch (e) {
      throw new Error("Supabase admin client is not configured.");
    }
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
