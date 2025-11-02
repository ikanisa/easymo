import { z } from 'zod'

export const adminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
})

export type AdminQueryInput = z.infer<typeof adminQuerySchema>

export const adminAuditSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  action: z.string(),
  target: z.string(),
  createdAt: z.string()
})

export const adminResponseSchema = z.object({
  audits: adminAuditSchema.array(),
  total: z.number().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1)
})

export type AdminResponse = z.infer<typeof adminResponseSchema>
