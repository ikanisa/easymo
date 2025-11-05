import { getEnvironment } from "@app-apis/config/environment";
import { fromSupabaseError } from "@app-apis/lib/errors";
import { logger } from "@app-apis/lib/logger";
import type { AppDatabase } from "@app-apis/types/database";
import type { RequestContext, SupabaseClientWrapper } from "@easymo/clients";
import { createSupabaseClientWrapper } from "@easymo/clients";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

export interface FavoritesListQuery {
  userId: string;
  page: number;
  pageSize: number;
}

export interface AdminListQuery {
  page: number;
  pageSize: number;
}

export interface DomainRepositories {
  favorites: {
    list(context: RequestContext, query: FavoritesListQuery): Promise<{
      rows: AppDatabase["public"]["Tables"]["favorites"]["Row"][];
      total: number;
    }>;
  };
  driver: {
    get(context: RequestContext, driverId: string): Promise<AppDatabase["public"]["Tables"]["drivers"]["Row"] | null>;
  };
  match: {
    create(
      context: RequestContext,
      payload: AppDatabase["public"]["Tables"]["matches"]["Insert"]
    ): Promise<AppDatabase["public"]["Tables"]["matches"]["Row"]>;
  };
  deeplink: {
    upsert(
      context: RequestContext,
      payload: AppDatabase["public"]["Tables"]["deeplinks"]["Insert"]
    ): Promise<AppDatabase["public"]["Tables"]["deeplinks"]["Row"]>;
  };
  broker: {
    publish(
      context: RequestContext,
      payload: AppDatabase["public"]["Tables"]["broker_messages"]["Insert"]
    ): Promise<AppDatabase["public"]["Tables"]["broker_messages"]["Row"]>;
  };
  admin: {
    list(context: RequestContext, query: AdminListQuery): Promise<{
      rows: AppDatabase["public"]["Tables"]["admin_audit"]["Row"][];
      total: number;
    }>;
  };
}

let cachedClient: SupabaseClientWrapper<AppDatabase> | null = null;
let cachedRepositories: DomainRepositories | null = null;

const getSupabaseClient = (): SupabaseClientWrapper<AppDatabase> => {
  if (!cachedClient) {
    const env = getEnvironment();
    cachedClient = createSupabaseClientWrapper<AppDatabase>(env.supabase, {
      onStart: ({ requestId }, operation) =>
        logger.debug("supabase.start", { requestId, operation }),
      onSuccess: ({ requestId }, operation, durationMs) =>
        logger.debug("supabase.success", { requestId, operation, durationMs }),
      onError: ({ requestId }, operation, durationMs, error) =>
        logger.error("supabase.error", { requestId, operation, durationMs, error }),
    });
  }

  return cachedClient;
};

const assertResponse = <T>(
  response: PostgrestSingleResponse<T>,
  requestId: string
): T => {
  if (response.error) {
    throw fromSupabaseError(response.error, requestId);
  }

  return response.data as T;
};

const createRepositories = (): DomainRepositories => {
  const wrapper = getSupabaseClient();

  return {
    favorites: {
      async list(context, query) {
        return wrapper.withInstrumentation(context, "favorites.list", async (client) => {
          const rangeStart = (query.page - 1) * query.pageSize;
          const rangeEnd = rangeStart + query.pageSize - 1;
          const response = await client
            .from("favorites")
            .select("*", { count: "exact" })
            .eq("user_id", query.userId)
            .order("created_at", { ascending: false })
            .range(rangeStart, rangeEnd);

          if (response.error) {
            throw fromSupabaseError(response.error, context.requestId);
          }

          return {
            rows: response.data ?? [],
            total: response.count ?? response.data?.length ?? 0,
          };
        });
      },
    },
    driver: {
      async get(context, driverId) {
        return wrapper.withInstrumentation(context, "driver.get", async (client) => {
          const response = await client
            .from("drivers")
            .select("*")
            .eq("id", driverId)
            .maybeSingle();
          if (response.error) {
            throw fromSupabaseError(response.error, context.requestId);
          }
          return response.data ?? null;
        });
      },
    },
    match: {
      async create(context, payload) {
        return wrapper.withInstrumentation(context, "match.create", async (client) => {
          const response = await client
            .from("matches")
            .insert(payload)
            .select("*")
            .single();
          return assertResponse(response, context.requestId);
        });
      },
    },
    deeplink: {
      async upsert(context, payload) {
        return wrapper.withInstrumentation(context, "deeplink.upsert", async (client) => {
          const response = await client
            .from("deeplinks")
            .upsert(payload, { onConflict: "target" })
            .select("*")
            .single();
          return assertResponse(response, context.requestId);
        });
      },
    },
    broker: {
      async publish(context, payload) {
        return wrapper.withInstrumentation(context, "broker.publish", async (client) => {
          const response = await client.from("broker_messages").insert(payload).select("*").single();
          return assertResponse(response, context.requestId);
        });
      },
    },
    admin: {
      async list(context, query) {
        return wrapper.withInstrumentation(context, "admin.list", async (client) => {
          const rangeStart = (query.page - 1) * query.pageSize;
          const rangeEnd = rangeStart + query.pageSize - 1;
          const response = await client
            .from("admin_audit")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(rangeStart, rangeEnd);
          if (response.error) {
            throw fromSupabaseError(response.error, context.requestId);
          }
          return {
            rows: response.data ?? [],
            total: response.count ?? response.data?.length ?? 0,
          };
        });
      },
    },
  };
};

export const getSupabaseRepositories = (): DomainRepositories => {
  if (!cachedRepositories) {
    cachedRepositories = createRepositories();
  }

  return cachedRepositories;
};

export const setSupabaseRepositoriesForTests = (repositories: DomainRepositories | null) => {
  cachedRepositories = repositories;
};

export const resetSupabaseClient = () => {
  cachedClient = null;
  cachedRepositories = null;
};
