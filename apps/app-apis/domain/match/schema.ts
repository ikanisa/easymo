import { z } from 'zod'

export const matchQuerySchema = z.object({
  driverId: z.string().uuid('driverId must be a valid UUID'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
})

export type MatchQueryInput = z.infer<typeof matchQuerySchema>

export const matchSchema = z.object({
  id: z.string().uuid(),
  driverId: z.string().uuid(),
  riderId: z.string().uuid(),
  status: z.enum(['matched', 'cancelled', 'completed']),
  createdAt: z.string()
})

export const matchResponseSchema = z.object({
  items: matchSchema.array(),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
})

export type MatchResponse = z.infer<typeof matchResponseSchema>
