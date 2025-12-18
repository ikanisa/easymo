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
 * Normalize phone number to E.164 format (Rwanda: +250...)
 * 
 * Examples:
 * - "0788123456" -> "+250788123456"
 * - "+250788123456" -> "+250788123456"
 * - "788123456" -> "+250788123456"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with 0, remove it (local format)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If doesn't start with 250 (Rwanda), add it
  if (!cleaned.startsWith("250")) {
    cleaned = "250" + cleaned;
  }

  // Always return with + prefix
  return "+" + cleaned;
}

/**
 * Validate phone number format (Rwanda: +250XXXXXXXXX)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Rwanda format: +250 followed by 9 digits
  return /^\+250\d{9}$/.test(normalized);
}

/**
 * Mask phone number for logging (PII protection)
 * 
 * Examples:
 * - "+250788123456" -> "+250****3456"
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  
  // For very short numbers, mask almost everything
  if (normalized.length <= 5) {
    return normalized.slice(0, 2) + "***";
  }
  
  // Standard masking: show +250 and last 4 digits
  return normalized.replace(/(\+250)\d+(\d{4})/, "$1****$2");
}

/**
 * Format phone number for display (Rwanda format)
 * 
 * Examples:
 * - "+250788123456" -> "+250 788 123 456"
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  const cleaned = normalized.replace(/^\+250/, "");
  
  // Format: +250 XXX XXX XXX
  const parts = cleaned.match(/.{1,3}/g) || [];
  return `+250 ${parts.join(" ")}`;
}
