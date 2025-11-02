import { z } from 'zod'

export const favoritesQuerySchema = z.object({
  driverId: z.string().uuid('driverId must be a valid UUID'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
})

export type FavoritesQueryInput = z.infer<typeof favoritesQuerySchema>

export const favoriteSchema = z.object({
  id: z.string().uuid(),
  driverId: z.string().uuid(),
  riderId: z.string().uuid(),
  notes: z.string().nullable(),
  createdAt: z.string()
})

export const favoritesResponseSchema = z.object({
  items: favoriteSchema.array(),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1)
})

export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>
