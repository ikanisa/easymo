<<<<<<< HEAD
import type { SMSParser, ParsedSMS } from '../types.js';

/**
 * Airtel Money SMS Parser
 * 
 * Handles SMS formats like:
 * - "You received RWF 3,000.00 from 0788123456. Your balance is RWF 8,000.00. Txn: AM123456789"
 * - "You sent RWF 1,500.00 to 0788123456. Charge: RWF 50.00. Balance: RWF 6,450.00. Txn: AM987654321"
 */
export class AirtelParser implements SMSParser {
  canParse(message: string, sender?: string): boolean {
    const normalizedSender = sender?.toUpperCase();
    const normalizedMessage = message.toUpperCase();
    
    // Check if sender is Airtel
    if (normalizedSender && normalizedSender.includes('AIRTEL')) {
      return true;
    }
    
    // Check for Airtel-specific keywords
    return normalizedMessage.includes('AIRTEL') ||
           (normalizedMessage.includes('RECEIVED') && normalizedMessage.includes('RWF')) ||
           (normalizedMessage.includes('SENT') && normalizedMessage.includes('RWF'));
  }
  
  parse(message: string, sender?: string): ParsedSMS | null {
    if (!this.canParse(message, sender)) {
      return null;
    }
    
    try {
      const result: Partial<ParsedSMS> = {
        provider: 'AIRTEL',
        rawMessage: message,
        currency: 'RWF',
        confidence: 0.5,
      };
      
      // Extract amount (e.g., "RWF 3,000.00" or "RWF3000")
      const amountMatch = message.match(/RWF\s*([\d,]+(?:\.\d{2})?)/i);
      if (amountMatch) {
        const amountStr = amountMatch[1].replace(/,/g, '');
        result.amount = parseFloat(amountStr);
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
      
      // Extract transaction ID (e.g., "AM123456789")
      const txIdMatch = message.match(/(?:Txn|Transaction|Ref|Reference)[:\s]*([A-Z0-9]+)/i);
      if (txIdMatch) {
        result.transactionId = txIdMatch[1];
        result.reference = txIdMatch[1];
        result.confidence = Math.min((result.confidence || 0.5) + 0.1, 1);
      }
      
      // Extract balance (e.g., "balance is RWF 8,000.00" or "Balance: RWF 8,000.00")
      const balanceMatch = message.match(/balance[:\s]*(?:is)?\s*RWF\s*([\d,]+(?:\.\d{2})?)/i);
      if (balanceMatch) {
        const balanceStr = balanceMatch[1].replace(/,/g, '');
        result.balance = parseFloat(balanceStr);
      }
      
      // Extract fee (e.g., "Charge: RWF 50.00" or "Fee: RWF 50")
      const feeMatch = message.match(/(?:charge|fee)[:\s]*RWF\s*([\d,]+(?:\.\d{2})?)/i);
      if (feeMatch) {
        const feeStr = feeMatch[1].replace(/,/g, '');
        result.fee = parseFloat(feeStr);
      }
      
      // Must have at least amount to be valid
      if (!result.amount) {
        return null;
      }
      
      return result as ParsedSMS;
    } catch (error) {
      return null;
    }
=======
import { BaseSMSParser } from "./base";
import type { ParsedSMS } from "../types";

export class AirtelParser extends BaseSMSParser {
  canParse(message: string): boolean {
    return /airtel/i.test(message);
  }

  parse(message: string): ParsedSMS | null {
    if (!this.canParse(message)) {
      return null;
    }

    const amount = this.extractAmount(message);
    const reference = this.extractReference(message);
    const balance = this.extractBalance(message);

    if (!amount) {
      return null;
    }

    // Determine transaction type
    let transactionType: ParsedSMS["transactionType"] = "UNKNOWN";
    if (/received|deposit|credited/i.test(message)) {
      transactionType = "DEPOSIT";
    } else if (/sent|withdraw|debited/i.test(message)) {
      transactionType = "WITHDRAWAL";
    }

    return {
      provider: "AIRTEL",
      transactionType,
      amount,
      currency: "RWF",
      reference: reference || "UNKNOWN",
      balance,
      raw: message,
    };
>>>>>>> feature/location-caching-and-mobility-deep-review
  }
}
