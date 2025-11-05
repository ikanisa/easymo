import { z } from "zod";

export const DeeplinkRequestSchema = z.object({
  target: z.string().min(1),
  url: z.string().url(),
  metadata: z.record(z.any()).optional(),
});

export type DeeplinkRequest = z.infer<typeof DeeplinkRequestSchema>;

export const DeeplinkResponseSchema = z.object({
  id: z.string().uuid(),
  target: z.string(),
  url: z.string().url(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.string(),
});

export type DeeplinkResponse = z.infer<typeof DeeplinkResponseSchema>;
