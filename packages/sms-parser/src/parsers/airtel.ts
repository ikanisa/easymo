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
  }
}
