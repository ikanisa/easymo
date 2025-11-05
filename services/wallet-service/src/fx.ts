import axios from "axios";

export class FXService {
  constructor(private readonly baseUrl?: string) {}

  async getUsdRate(currency: string): Promise<number> {
    const code = (currency || "USD").toUpperCase();
    if (code === "USD") return 1;
    // Try external API if configured
    if (this.baseUrl) {
      try {
        const resp = await axios.get(`${this.baseUrl}`, { params: { base: code, symbols: "USD" }, timeout: 5000 });
        const rate = resp.data?.rates?.USD ?? resp.data?.USD ?? null;
        if (typeof rate === "number" && rate > 0) return 1 / rate; // base=code => USD per 1 code => tokens per unit
      } catch {
        // ignore
      }
    }
    // Fallback static approximations if API missing
    switch (code) {
      case "RWF":
        return 0.0008; // ~1 USD = 1300 RWF
      case "KES":
        return 0.007; // rough
      default:
        return 1; // assume parity
    }
  }

  async convertToUsdTokens(amount: number, currency: string): Promise<number> {
    const rate = await this.getUsdRate(currency);
    // Tokens pegged 1 token = 1 USD
    return Math.round(amount * rate * 100) / 100; // 2dp
  }
}

