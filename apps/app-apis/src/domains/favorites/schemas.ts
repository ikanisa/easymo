import { z } from "zod";

export const FavoritesQuerySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type FavoritesQuery = z.infer<typeof FavoritesQuerySchema>;

export const FavoriteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  driverId: z.string().uuid(),
  createdAt: z.string(),
});

export const FavoritesResponseSchema = z.object({
  items: z.array(FavoriteSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});

export type FavoritesResponse = z.infer<typeof FavoritesResponseSchema>;
