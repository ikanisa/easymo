import type { HandlerContext } from '../../lib/handler'
import { getSupabaseRepositories } from '../../lib/supabase'
import type { AdminQueryInput, AdminResponse } from './schema'

export async function listAdminAudits(
  input: AdminQueryInput,
  context: HandlerContext
): Promise<AdminResponse> {
  const repositories = getSupabaseRepositories()
  const { page, pageSize } = input
  const offset = (page - 1) * pageSize

  const result = await context.query({
    span: 'admin.listAudits',
    cacheKey: `admin:${page}:${pageSize}`,
    thresholdMs: 250,
    exec: () => repositories.admin.listAudits({ limit: pageSize, offset })
  })

  return {
    audits: result.data.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      target: row.target,
      createdAt: row.created_at
    })),
    total: result.count,
    page,
    pageSize
  }
}
