import { createRouteHandler } from '../../../lib/handler'
import { adminQuerySchema, listAdminAudits } from '../../../domain/admin'

export const GET = createRouteHandler({
  featureFlag: 'admin',
  schema: adminQuerySchema,
  handler: listAdminAudits
})
