import { z } from 'zod'

export const driverQuerySchema = z.object({
  id: z.string().uuid('id must be a valid UUID')
})

export type DriverQueryInput = z.infer<typeof driverQuerySchema>

export const driverResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rating: z.number(),
  active: z.boolean(),
  preferredCity: z.string().nullable(),
  updatedAt: z.string()
})

export type DriverResponse = z.infer<typeof driverResponseSchema>
