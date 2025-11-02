import { createRouteHandler } from '../../../lib/handler'
import { listMatches, matchQuerySchema } from '../../../domain/match'

export const GET = createRouteHandler({
  featureFlag: 'match',
  schema: matchQuerySchema,
  handler: listMatches
})
