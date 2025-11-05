import type { HandlerContext } from '../../lib/handler'
import { getSupabaseRepositories } from '../../lib/supabase'
import type { DriverResponse, DriverQueryInput } from './schema'
import { ApiError } from '../../lib/errors'

export async function getDriver(
  input: DriverQueryInput,
  context: HandlerContext
): Promise<DriverResponse> {
  const repositories = getSupabaseRepositories()
  const driver = await context.query({
    span: 'driver.fetch',
    cacheKey: `driver:${input.id}`,
    exec: () => repositories.drivers.findById(input.id)
  })

  if (!driver) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: `Driver ${input.id} was not found`,
      status: 404
    })
  }

  return {
    id: driver.id,
    name: driver.name,
    rating: driver.rating,
    active: driver.active,
    preferredCity: driver.preferred_city,
    updatedAt: driver.updated_at
  }
}
