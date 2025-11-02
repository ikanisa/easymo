import { z } from "zod";

export const BrokerRequestSchema = z.object({
  topic: z.string().min(1),
  payload: z.record(z.any()),
});

export type BrokerRequest = z.infer<typeof BrokerRequestSchema>;

export const BrokerResponseSchema = z.object({
  id: z.string().uuid(),
  topic: z.string(),
  payload: z.record(z.any()),
  createdAt: z.string(),
});

export type BrokerResponse = z.infer<typeof BrokerResponseSchema>;
