import { createRouteHandler } from '../../../lib/handler'
import { driverQuerySchema, getDriver } from '../../../domain/driver'

export const GET = createRouteHandler({
  featureFlag: 'driver',
  schema: driverQuerySchema,
  handler: getDriver
})
