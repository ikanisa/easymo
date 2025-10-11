import { z } from "zod";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockCampaigns } from "@/lib/mock-data";
import { type Campaign, campaignSchema } from "@/lib/schemas";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export async function listCampaigns(
  params: Pagination = {},
): Promise<PaginatedResult<Campaign>> {
  if (!isServer) {
    if (useMocks) {
      return paginateArray(mockCampaigns, params);
    }

    try {
      const searchParams = new URLSearchParams();
      if (params.offset !== undefined) {
        searchParams.set("offset", String(params.offset));
      }
      if (params.limit !== undefined) {
        searchParams.set("limit", String(params.limit));
      }

      const response = await fetch(
        `/api/campaigns?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns from API");
      }
      const json = await response.json();
      return z
        .object({
          data: z.array(campaignSchema),
          total: z.number(),
          hasMore: z.boolean(),
        })
        .parse(json);
    } catch (error) {
      console.error("Client campaigns fetch failed", error);
      return paginateArray(mockCampaigns, params);
    }
  }

  if (useMocks) {
    return paginateArray(mockCampaigns, params);
  }

  const { getSupabaseAdminClient } = await import(
    "@/lib/server/supabase-admin"
  );
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return paginateArray(mockCampaigns, params);
  }

  const query = adminClient
    .from("campaigns")
    .select(
      "id, name, type, status, template_id, created_at, started_at, finished_at, metadata",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25) - 1);

  const { data, error, count } = await query;

  if (error || !data) {
    console.error("Failed to fetch campaigns from Supabase", error);
    return paginateArray(mockCampaigns, params);
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type as Campaign["type"],
      status: item.status as Campaign["status"],
      templateId: item.template_id,
      createdAt: item.created_at,
      startedAt: item.started_at,
      finishedAt: item.finished_at,
      metadata: item.metadata ?? null,
    })),
    total: count ?? data.length,
    hasMore: params.offset !== undefined && params.limit !== undefined
      ? (params.offset + params.limit) < (count ?? data.length)
      : false,
  };
}
