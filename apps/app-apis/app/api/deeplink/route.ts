import { createRouteHandler } from '../../../lib/handler'
import { createDeeplink, deeplinkBodySchema } from '../../../domain/deeplink'

export const POST = createRouteHandler({
  featureFlag: 'deeplink',
  schema: deeplinkBodySchema,
  handler: createDeeplink,
  status: 201
})
