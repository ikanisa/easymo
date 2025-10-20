// Lightweight formatting helpers for WhatsApp flows (Deno runtime)
// Centralizes number, currency, and datetime formatting with explicit locales.

// Accept any BCP‑47 tag; callers may pass base (e.g. "en") or region (e.g. "en-GB").
type LocaleTag = string;

// Minimal currency metadata where fractional digits differ or are commonly used.
// Add to this map as new currencies appear in flows.
const CURRENCY_MINOR_UNITS: Record<string, number> = {
  // African currencies commonly used in flows
  RWF: 0,
  UGX: 0,
  KES: 2,
  ZAR: 2,
  // Generics
  USD: 2,
  EUR: 2,
};

export function formatNumber(
  value: number,
  locale: LocaleTag,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale || "en", options).format(value);
}

export function formatMoney(
  amount: number,
  currency: string | null | undefined,
  locale: LocaleTag,
  options?: { isMinor?: boolean; display?: "code" | "symbol" | "name" },
): string {
  const code = (currency ?? "").toUpperCase();
  const minor = options?.isMinor === true;
  const fraction = code && CURRENCY_MINOR_UNITS[code] != null
    ? CURRENCY_MINOR_UNITS[code]
    : 2;
  const scaled = minor ? amount / Math.pow(10, fraction) : amount;

  const display = options?.display ?? "code";
  if (display === "symbol") {
    try {
      return new Intl.NumberFormat(locale || "en", {
        style: "currency",
        currency: code || "USD",
        currencyDisplay: "symbol",
      }).format(scaled);
    } catch {
      // Fallback to code when Intl cannot format the currency
    }
  }

  // Default: code + localized number
  const formatted = formatNumber(scaled, locale || "en");
  return code ? `${code} ${formatted}` : formatted;
}

export function formatDateTime(
  iso: string | Date,
  locale: LocaleTag,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  const fmt = new Intl.DateTimeFormat(locale || "en", {
    timeZone,
    ...options,
  });
  return fmt.format(date);
}
