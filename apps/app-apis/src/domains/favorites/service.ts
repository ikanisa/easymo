import { cached } from "@app-apis/lib/cache";
import type { DomainHandlerContext } from "@app-apis/lib/createDomainHandler";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import { measure } from "@app-apis/lib/perf";
import type { FavoritesQuery, FavoritesResponse } from "@app-apis/domains/favorites/schemas";
import type { AppDatabase } from "@app-apis/types/database";

const mapFavorite = (
  row: AppDatabase["public"]["Tables"]["favorites"]["Row"]
) => ({
  id: row.id,
  userId: row.user_id,
  driverId: row.driver_id,
  createdAt: row.created_at,
});

export const listFavorites = async (
  context: DomainHandlerContext,
  query: FavoritesQuery
): Promise<FavoritesResponse> => {
  const cacheKey = `favorites:${query.userId}:${query.page}:${query.pageSize}`;
  return cached(cacheKey, async () => {
    const repositories = getSupabaseRepositories();
    const result = await measure("favorites.repository", () =>
      repositories.favorites.list(context, {
        userId: query.userId,
        page: query.page,
        pageSize: query.pageSize,
      })
    );

    return {
      items: result.rows.map(mapFavorite),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      },
    };
  });
};
