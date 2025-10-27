import { z } from 'zod';

export const ResolveTokenSchema = z.object({
  token: z.string().min(1),
  msisdn: z.string().optional(),
});

export type ResolveTokenDto = z.infer<typeof ResolveTokenSchema>;
