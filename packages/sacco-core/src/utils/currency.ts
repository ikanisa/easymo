/**
 * Format currency amount
 * @param amount - Amount in minor units (e.g., cents)
 * @param currency - Currency code (default: RWF)
 * @returns Formatted currency string (e.g., "RWF 1,234,567")
 */
export function formatCurrency(amount: number, currency: string = "RWF"): string {
  const formatted = amount.toLocaleString("en-RW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return `${currency} ${formatted}`;
}

/**
 * Parse currency string to number
 * @param value - Currency string (e.g., "1,234,567" or "RWF 1,234,567")
 * @returns Numeric amount
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned) || 0;
}
