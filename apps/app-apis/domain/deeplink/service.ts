import type { DeeplinkInsert } from '@easymo/clients'
import type { HandlerContext } from '../../lib/handler'
import { getSupabaseRepositories } from '../../lib/supabase'
import type { DeeplinkBodyInput, DeeplinkResponse } from './schema'

export async function createDeeplink(
  input: DeeplinkBodyInput,
  context: HandlerContext
): Promise<DeeplinkResponse> {
  const repositories = getSupabaseRepositories()
  const payload: DeeplinkInsert = {
    id: input.id,
    url: input.url,
    expires_at: input.expiresAt,
    metadata: input.metadata
  }

  const deeplink = await context.query({
    span: 'deeplink.create',
    cacheKey: undefined,
    thresholdMs: 200,
    exec: () => repositories.deeplink.create(payload)
  })

  return {
    id: deeplink.id,
    url: deeplink.url,
    expiresAt: deeplink.expires_at,
    createdAt: deeplink.created_at,
    metadata: deeplink.metadata
  }
}
