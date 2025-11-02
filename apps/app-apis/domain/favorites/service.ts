import { type FavoritesResponse, type FavoritesQueryInput } from './schema'
import { getSupabaseRepositories } from '../../lib/supabase'
import type { HandlerContext } from '../../lib/handler'

export async function listFavorites(
  input: FavoritesQueryInput,
  context: HandlerContext
): Promise<FavoritesResponse> {
  const repositories = getSupabaseRepositories()
  const { page, pageSize, driverId } = input
  const offset = (page - 1) * pageSize

  const result = await context.query({
    span: 'favorites.list',
    cacheKey: `favorites:${driverId}:${page}:${pageSize}`,
    exec: () => repositories.favorites.listByDriverId(driverId, { limit: pageSize, offset })
  })

  return {
    items: result.data.map((row) => ({
      id: row.id,
      driverId: row.driver_id,
      riderId: row.rider_id,
      notes: row.notes,
      createdAt: row.created_at
    })),
    total: result.count,
    page,
    pageSize
  }
}
