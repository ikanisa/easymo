import { z } from 'zod';

export const ParsedSMSSchema = z.object({
  provider: z.enum(['MTN', 'AIRTEL', 'UNKNOWN']),
  amount: z.number().positive(),
  currency: z.string().default('RWF'),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  reference: z.string().optional(),
  transactionId: z.string().optional(),
  timestamp: z.date().optional(),
  balance: z.number().optional(),
  fee: z.number().optional(),
  confidence: z.number().min(0).max(1).default(1),
  rawMessage: z.string(),
  transactionType: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'UNKNOWN']).optional(),
});

export type ParsedSMS = z.infer<typeof ParsedSMSSchema>;

export interface SMSParser {
  /**
   * Parse an SMS message
   * @param message - The SMS message text
   * @param sender - The SMS sender (e.g., "MTN", "AIRTEL")
   * @returns Parsed SMS data or null if parsing failed
   */
  parse(message: string, sender?: string): ParsedSMS | null;
  
  /**
   * Check if this parser can handle the given message
   */
  canParse(message: string, sender?: string): boolean;
}
