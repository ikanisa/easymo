import { MTNParser } from './parsers/mtn.js';
import { AirtelParser } from './parsers/airtel.js';
import type { SMSParser, ParsedSMS } from './types.js';

/**
 * Utility function to parse SMS messages
 * Tries all available parsers and returns the first successful parse
 */
export function parseSMS(message: string, sender?: string): ParsedSMS | null {
  const parsers: SMSParser[] = [
    new MTNParser(),
    new AirtelParser(),
  ];
  
  for (const parser of parsers) {
    if (parser.canParse(message, sender)) {
      const result = parser.parse(message, sender);
      if (result) {
        return result;
      }
    }
  }
  
  return null;
}

/**
 * Extract phone number from SMS message
 * Looks for Rwanda phone numbers in +250XXXXXXXXX or 07XXXXXXXX format
 */
export function extractPhoneNumber(message: string): string | null {
  // Match Rwanda phone numbers: +250 followed by 9 digits, or 07 followed by 8 digits
  const phoneMatch = message.match(/(?:\+250\d{9}|07\d{8})/);
  return phoneMatch ? phoneMatch[0] : null;
}

/**
 * Normalize amount string to number
 * Handles formats like "5,000", "5000", "5,000.00"
 */
export function normalizeAmount(amountStr: string): number | null {
  try {
    const normalized = amountStr.replace(/,/g, '');
    const amount = parseFloat(normalized);
    return isNaN(amount) ? null : amount;
  } catch {
    return null;
  }
}
