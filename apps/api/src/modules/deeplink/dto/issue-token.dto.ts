import { z } from 'zod';

export const SupportedFlows = ['insurance_attach', 'basket_open', 'generate_qr'] as const;
export type SupportedFlow = typeof SupportedFlows[number];

export const IssueTokenSchema = z.object({
  flow: z.enum(SupportedFlows),
  payload: z.record(z.unknown()).optional(),
  ttl: z.number().int().positive().optional().default(14 * 24 * 60 * 60), // 14 days in seconds
  msisdn: z.string().optional(),
});

export type IssueTokenDto = z.infer<typeof IssueTokenSchema>;
