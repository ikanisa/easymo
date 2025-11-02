import type { HandlerContext } from '../../lib/handler'
import { getSupabaseRepositories } from '../../lib/supabase'
import type { MatchQueryInput, MatchResponse } from './schema'

export async function listMatches(
  input: MatchQueryInput,
  context: HandlerContext
): Promise<MatchResponse> {
  const repositories = getSupabaseRepositories()
  const { page, pageSize, driverId } = input
  const offset = (page - 1) * pageSize

  const result = await context.query({
    span: 'match.list',
    cacheKey: `match:${driverId}:${page}:${pageSize}`,
    exec: () => repositories.matches.listByDriverId(driverId, { limit: pageSize, offset })
  })

  return {
    items: result.data.map((row) => ({
      id: row.id,
      driverId: row.driver_id,
      riderId: row.rider_id,
      status: row.status,
      createdAt: row.created_at
    })),
    total: result.count,
    page,
    pageSize
  }
}
