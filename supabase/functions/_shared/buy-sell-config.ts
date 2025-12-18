/**
 * Buy & Sell Agent Configuration and Phone Utilities
 * 
 * Configuration for Rwanda-only operations and phone number utilities:
 * - Phone number normalization (Rwanda format: +250...)
 * 
 * System is Rwanda-only, no country filtering or geo-blocking needed.
 */

// =====================================================
// PHONE NUMBER UTILITIES (Rwanda-only)
// =====================================================

/**
 * Normalize phone number - keep original format, only add + prefix if missing
 * Accepts any phone number format from any country code - no country-specific normalization
 * 
 * Examples:
 * - "0788123456" -> "+0788123456"
 * - "+250788123456" -> "+250788123456"
 * - "788123456" -> "+788123456"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  // If already has +, return as is. Otherwise add + prefix
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/**
 * Validate phone number format
 * Accepts any phone number format from any country code - no format restrictions
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  // Accept any non-empty string as a valid phone number
  // No format validation - allow all country codes and formats
  return phone.trim().length > 0;
}

/**
 * Mask phone number for logging (PII protection)
 * Works with any phone number format from any country
 * 
 * Examples:
 * - "+250788123456" -> "+250****3456"
 * - "+1234567890" -> "+123****7890"
 * - "1234567890" -> "+123****7890"
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  
  // For very short numbers, mask almost everything
  if (normalized.length <= 5) {
    return normalized.slice(0, 2) + "***";
  }
  
  // Generic masking: show first 3-4 characters (country code) and last 4 digits
  // Works for any country code length
  if (normalized.length <= 7) {
    return normalized.slice(0, 2) + "****";
  }
  
  // Show first 3-4 chars (typically country code) and last 4 digits
  const prefixLength = Math.min(4, Math.floor(normalized.length / 3));
  return normalized.slice(0, prefixLength) + "****" + normalized.slice(-4);
}

/**
 * Format phone number for display
 * Preserves original format with spacing for readability
 * Works with any phone number format from any country
 * 
 * Examples:
 * - "+250788123456" -> "+250 788 123 456"
 * - "+15551234567" -> "+1 555 123 4567"
 * - "+1234567890" -> "+1 234 567 890"
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length <= 4) return normalized;
  
  // Extract country code (1-3 digits) and number part
  const match = normalized.match(/^\+(\d{1,3})(.*)$/);
  if (match) {
    const countryCode = match[1];
    const number = match[2];
    // Group remaining digits in groups of 3 for readability
    const parts = number.match(/.{1,3}/g) || [];
    return `+${countryCode} ${parts.join(" ")}`;
  }
  
  // If no + prefix, just return as is (shouldn't happen after normalization)
  return normalized;
}
