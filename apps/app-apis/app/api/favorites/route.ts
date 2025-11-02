import { createRouteHandler } from '../../../lib/handler'
import { favoritesQuerySchema, listFavorites } from '../../../domain/favorites'

export const GET = createRouteHandler({
  featureFlag: 'favorites',
  schema: favoritesQuerySchema,
  handler: listFavorites
})
