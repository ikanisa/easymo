import { z } from 'zod'

export const deeplinkBodySchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({})
})

export type DeeplinkBodyInput = z.infer<typeof deeplinkBodySchema>

export const deeplinkResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  createdAt: z.string(),
  metadata: z.record(z.unknown())
})

export type DeeplinkResponse = z.infer<typeof deeplinkResponseSchema>
