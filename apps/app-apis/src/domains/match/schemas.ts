import { z } from "zod";

export const MatchRequestSchema = z.object({
  riderId: z.string().uuid("riderId must be a valid UUID"),
  driverId: z.string().uuid("driverId must be a valid UUID"),
  pickupTime: z.string().datetime(),
});

export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export const MatchResponseSchema = z.object({
  id: z.string().uuid(),
  riderId: z.string().uuid(),
  driverId: z.string().uuid(),
  pickupTime: z.string(),
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export type MatchResponse = z.infer<typeof MatchResponseSchema>;
