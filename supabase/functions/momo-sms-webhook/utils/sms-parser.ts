/**
 * Mobile Money SMS Parser
 * Extracts amount, sender name, and transaction ID from MoMo SMS
 * Supports MTN, Vodafone Cash, and AirtelTigo formats
 */

export interface ParsedMomoSms {
  amount: number | null;
  senderName: string | null;
  transactionId: string | null;
  provider: "mtn" | "vodafone" | "airteltigo" | null;
  currency: string | null;
}

export function parseMomoSms(message: string): ParsedMomoSms {
  const result: ParsedMomoSms = {
    amount: null,
    senderName: null,
    transactionId: null,
    provider: null,
    currency: null,
  };

  const upperMessage = message.toUpperCase();

  // Detect provider
  if (upperMessage.includes("MTN") || upperMessage.includes("MOMO")) {
    result.provider = "mtn";
  } else if (upperMessage.includes("VODAFONE") || upperMessage.includes("VCASH")) {
    result.provider = "vodafone";
  } else if (upperMessage.includes("AIRTEL") || upperMessage.includes("TIGO")) {
    result.provider = "airteltigo";
  }

  // Extract currency (GHS for Ghana, RWF for Rwanda)
  if (message.includes("GHS") || message.includes("GH₵")) {
    result.currency = "GHS";
  } else if (message.includes("RWF") || message.includes("FRW")) {
    result.currency = "RWF";
  }

  // Pattern 1: MTN MoMo Ghana
  // "You have received 5,000.00 GHS from JOHN DOE. Transaction ID: 1234567890..."
  const mtnPattern1 = /received\s+([\d,]+(?:\.\d{2})?)\s*(?:GHS|GH₵|RWF)/i;
  const mtnMatch1 = message.match(mtnPattern1);
  if (mtnMatch1) {
    result.amount = parseFloat(mtnMatch1[1].replace(/,/g, ""));
    if (!result.provider) result.provider = "mtn";
  }

  // Pattern 2: Vodafone Cash
  // "You have received GHS 5,000.00 from JOHN DOE. Ref: VC123456..."
  const vodaPattern = /received\s+(?:GHS|GH₵|RWF)\s*([\d,]+(?:\.\d{2})?)/i;
  const vodaMatch = message.match(vodaPattern);
  if (vodaMatch && !result.amount) {
    result.amount = parseFloat(vodaMatch[1].replace(/,/g, ""));
    if (!result.provider) result.provider = "vodafone";
  }

  // Pattern 3: AirtelTigo Money
  // "You have received 5000 GHS from JOHN DOE. TxnID: AT123456..."
  const atPattern = /received\s+([\d,]+)\s*(?:GHS|GH₵|RWF)/i;
  const atMatch = message.match(atPattern);
  if (atMatch && !result.amount) {
    result.amount = parseFloat(atMatch[1].replace(/,/g, ""));
    if (!result.provider) result.provider = "airteltigo";
  }

  // Extract sender name
  // Pattern: "from JOHN DOE" or "from John Doe"
  const senderPattern = /from\s+([A-Z][A-Z\s]+?)(?:\.|,|Transaction|Ref|TxnID|Your|New|Fee)/i;
  const senderMatch = message.match(senderPattern);
  if (senderMatch) {
    result.senderName = senderMatch[1].trim();
  }

  // Extract transaction ID
  // MTN: "Transaction ID: 1234567890"
  const txnIdPattern1 = /Transaction\s+ID[:\s]+(\w+)/i;
  const txnMatch1 = message.match(txnIdPattern1);
  if (txnMatch1) {
    result.transactionId = txnMatch1[1];
  }

  // Vodafone: "Ref: VC123456"
  const refPattern = /Ref[:\s]+(\w+)/i;
  const refMatch = message.match(refPattern);
  if (refMatch && !result.transactionId) {
    result.transactionId = refMatch[1];
  }

  // AirtelTigo: "TxnID: AT123456"
  const txnIdPattern2 = /TxnID[:\s]+(\w+)/i;
  const txnMatch2 = message.match(txnIdPattern2);
  if (txnMatch2 && !result.transactionId) {
    result.transactionId = txnMatch2[1];
  }

  return result;
}
