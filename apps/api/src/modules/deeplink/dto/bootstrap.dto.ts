import { z } from 'zod';

export const BootstrapSchema = z.object({
  token: z.string().min(1),
  msisdn: z.string().optional(),
});

export type BootstrapDto = z.infer<typeof BootstrapSchema>;
