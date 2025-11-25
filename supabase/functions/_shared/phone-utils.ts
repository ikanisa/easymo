/**
 * Phone Number Utilities
 * 
 * Common utilities for phone number handling including normalization and masking.
 * Used across wa-webhook services for consistent phone number processing.
 */

/**
 * Normalize phone number by removing non-numeric characters except leading +
 * 
 * @example
 * normalizePhone("+250-788-123-456") // Returns "+250788123456"
 * normalizePhone("250788123456") // Returns "250788123456"
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  // Keep leading + if present, then only digits
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Mask phone number for logging (privacy protection)
 * Shows first few and last few digits with asterisks in between.
 * 
 * @param phone - Phone number to mask
 * @param visibleStart - Number of characters to show at start (default: 4)
 * @param visibleEnd - Number of characters to show at end (default: 3)
 * 
 * @example
 * maskPhone("+250788123456") // Returns "+250****456"
 * maskPhone("+250788123456", 7, 3) // Returns "+250788***456"
 */
export function maskPhone(
  phone: string | null | undefined,
  visibleStart = 4,
  visibleEnd = 3,
): string {
  if (!phone || typeof phone !== "string") return "***";
  if (phone.length <= visibleStart + visibleEnd) return "***";
  
  return phone.slice(0, visibleStart) + "****" + phone.slice(-visibleEnd);
}

/**
 * Validate if a string looks like a phone number
 * Basic validation - starts with + and contains 10-15 digits
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\+/, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Extract country code from phone number (assumes E.164 format)
 * 
 * @example
 * getCountryCode("+250788123456") // Returns "250"
 * getCountryCode("+1555123456") // Returns "1"
 */
export function getCountryCode(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized.startsWith("+")) return null;
  
  // Common country code lengths: 1-3 digits
  // Rwanda: +250, US: +1, UK: +44, etc.
  const digits = normalized.slice(1);
  
  // Try to match known patterns
  if (digits.startsWith("1")) return "1"; // North America
  if (digits.startsWith("7")) return "7"; // Russia/Kazakhstan
  if (digits.startsWith("20")) return "20"; // Egypt
  if (digits.startsWith("27")) return "27"; // South Africa
  if (digits.startsWith("30") || digits.startsWith("31") || digits.startsWith("32") ||
      digits.startsWith("33") || digits.startsWith("34") || digits.startsWith("36") ||
      digits.startsWith("39")) return digits.slice(0, 2); // Europe
  if (digits.startsWith("44")) return "44"; // UK
  if (digits.startsWith("49")) return "49"; // Germany
  if (digits.startsWith("250")) return "250"; // Rwanda
  if (digits.startsWith("254")) return "254"; // Kenya
  if (digits.startsWith("255")) return "255"; // Tanzania
  if (digits.startsWith("256")) return "256"; // Uganda
  if (digits.startsWith("257")) return "257"; // Burundi
  if (digits.startsWith("243")) return "243"; // DRC
  
  // Default: assume 2-3 digit country code
  return digits.length >= 3 ? digits.slice(0, 3) : digits.slice(0, 2);
}
