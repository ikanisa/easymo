import { z } from "zod";

export const AdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminQuery = z.infer<typeof AdminQuerySchema>;

export const AdminAuditSchema = z.object({
  id: z.string().uuid(),
  actor: z.string(),
  action: z.string(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.string(),
});

export const AdminResponseSchema = z.object({
  items: z.array(AdminAuditSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
});

export type AdminResponse = z.infer<typeof AdminResponseSchema>;
