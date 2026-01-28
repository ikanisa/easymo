import type { ParsedSMS,SMSParser } from '../types.js';

/**
 * MTN Mobile Money SMS Parser
 * 
 * Handles SMS formats like:
 * - "You have received RWF 5,000 from 0788123456. Your new balance is RWF 10,000. Transaction ID: MP123456789"
 * - "You have sent RWF 2,000 to 0788123456. Fee: RWF 100. Your new balance is RWF 7,900. Transaction ID: MP987654321"
 */
export class MTNParser implements SMSParser {
  canParse(message: string, sender?: string): boolean {
    const normalizedSender = sender?.toUpperCase();
    const normalizedMessage = message.toUpperCase();
    
    // Check if sender is MTN
    if (normalizedSender && normalizedSender.includes('MTN')) {
      return true;
    }
    
    // Check for MTN-specific keywords
    return normalizedMessage.includes('MTN') ||
           normalizedMessage.includes('MOMO') ||
           (normalizedMessage.includes('RECEIVED') && normalizedMessage.includes('RWF')) ||
           (normalizedMessage.includes('SENT') && normalizedMessage.includes('RWF'));
  }
  
  parse(message: string, sender?: string): ParsedSMS | null {
    if (!this.canParse(message, sender)) {
      return null;
    }
    
    try {
      const result: Partial<ParsedSMS> = {
        provider: 'MTN',
        rawMessage: message,
        currency: 'RWF',
        confidence: 0.5,
      };
      
      // Extract amount (e.g., "RWF 5,000" or "RWF5000")
      const amountMatch = message.match(/RWF\s*([\d,]+)/i);
      if (amountMatch) {
        const amountStr = amountMatch[1].replace(/,/g, '');
        result.amount = parseInt(amountStr, 10);
        result.confidence = 0.7;
      }
      
      // Extract phone number (e.g., "0788123456" or "+250788123456")
      const phoneMatch = message.match(/(?:from|to)\s*(\+?\d{10,13})/i);
      if (phoneMatch) {
        const phone = phoneMatch[1];
        if (message.toLowerCase().includes('received')) {
          result.sender = phone;
        } else if (message.toLowerCase().includes('sent')) {
          result.recipient = phone;
        }
        result.confidence = Math.min((result.confidence || 0.5) + 0.1, 1);
      }
      
      // Extract transaction ID (e.g., "MP123456789")
      const txIdMatch = message.match(/(?:Transaction\s*ID|Ref|Reference)[:\s]*([A-Z0-9]+)/i);
      if (txIdMatch) {
        result.transactionId = txIdMatch[1];
        result.reference = txIdMatch[1];
        result.confidence = Math.min((result.confidence || 0.5) + 0.1, 1);
      }
      
      // Extract balance (e.g., "new balance is RWF 10,000")
      const balanceMatch = message.match(/balance\s*(?:is)?\s*RWF\s*([\d,]+)/i);
      if (balanceMatch) {
        const balanceStr = balanceMatch[1].replace(/,/g, '');
        result.balance = parseInt(balanceStr, 10);
      }
      
      // Extract fee (e.g., "Fee: RWF 100")
      const feeMatch = message.match(/fee[:\s]*RWF\s*([\d,]+)/i);
      if (feeMatch) {
        const feeStr = feeMatch[1].replace(/,/g, '');
        result.fee = parseInt(feeStr, 10);
      }
      
      // Must have at least amount to be valid
      if (!result.amount) {
        return null;
      }
      
      return result as ParsedSMS;
    } catch (error) {
      return null;
    }
  }
}
