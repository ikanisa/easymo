import { z } from "zod";

export const DriverRequestSchema = z.object({
  driverId: z.string().uuid("driverId must be a valid UUID"),
});

export type DriverRequest = z.infer<typeof DriverRequestSchema>;

export const DriverResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rating: z.number().min(0).max(5),
  vehicle: z.string(),
  updatedAt: z.string(),
});

export type DriverResponse = z.infer<typeof DriverResponseSchema>;
