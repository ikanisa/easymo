import type { HandlerContext } from '../../lib/handler'
import { getSupabaseRepositories } from '../../lib/supabase'
import type { BrokerQueryInput, BrokerResponse } from './schema'
import { ApiError } from '../../lib/errors'

export async function getBrokerMessage(
  input: BrokerQueryInput,
  context: HandlerContext
): Promise<BrokerResponse> {
  const repositories = getSupabaseRepositories()
  const message = await context.query({
    span: 'broker.fetch',
    cacheKey: `broker:${input.id}`,
    thresholdMs: 180,
    exec: () => repositories.broker.getById(input.id)
  })

  if (!message) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: `Broker message ${input.id} was not found`,
      status: 404
    })
  }

  return {
    id: message.id,
    topic: message.topic,
    payload: message.payload,
    deliveredAt: message.delivered_at,
    createdAt: message.created_at
  }
}
