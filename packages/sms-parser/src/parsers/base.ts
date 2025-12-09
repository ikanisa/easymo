import type { SMSParser, ParsedSMS } from "../types";

export abstract class BaseSMSParser implements SMSParser {
  abstract canParse(message: string): boolean;
  abstract parse(message: string): ParsedSMS | null;

  protected extractAmount(text: string): number | null {
    const patterns = [
      /(?:RWF|Rwf|rwf)\s*([\d,]+)/,
      /([\d,]+)\s*(?:RWF|Rwf|rwf)/,
      /Amount:\s*([\d,]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ""));
      }
    }

    return null;
  }

  protected extractReference(text: string): string | null {
    const patterns = [
      /Ref:\s*([A-Z0-9]+)/i,
      /Reference:\s*([A-Z0-9]+)/i,
      /ID:\s*([A-Z0-9]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  protected extractBalance(text: string): number | null {
    const patterns = [
      /Balance:\s*(?:RWF|Rwf|rwf)?\s*([\d,]+)/i,
      /New Balance:\s*(?:RWF|Rwf|rwf)?\s*([\d,]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ""));
      }
    }

    return null;
  }
}
