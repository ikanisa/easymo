import { z } from 'zod'

export const brokerQuerySchema = z.object({
  id: z.string().uuid('id must be a valid UUID')
})

export type BrokerQueryInput = z.infer<typeof brokerQuerySchema>

export const brokerResponseSchema = z.object({
  id: z.string().uuid(),
  topic: z.string(),
  payload: z.record(z.unknown()),
  deliveredAt: z.string().nullable(),
  createdAt: z.string()
})

export type BrokerResponse = z.infer<typeof brokerResponseSchema>
