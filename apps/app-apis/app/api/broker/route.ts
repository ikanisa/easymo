import { createRouteHandler } from '../../../lib/handler'
import { brokerQuerySchema, getBrokerMessage } from '../../../domain/broker'

export const GET = createRouteHandler({
  featureFlag: 'broker',
  schema: brokerQuerySchema,
  handler: getBrokerMessage
})
