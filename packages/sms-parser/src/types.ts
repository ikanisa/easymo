export interface ParsedSMS {
  provider: "MTN" | "AIRTEL" | "UNKNOWN";
  transactionType: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "UNKNOWN";
  amount: number;
  currency: string;
  reference: string;
  sender?: string;
  recipient?: string;
  balance?: number;
  timestamp?: Date;
  raw: string;
}

export interface SMSParser {
  canParse(message: string): boolean;
  parse(message: string): ParsedSMS | null;
}
