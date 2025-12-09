/**
 * Normalize SMS text for parsing
 * - Remove extra whitespace
 * - Normalize line breaks
 * - Trim
 */
export function normalizeSMS(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract all numbers from text
 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}
