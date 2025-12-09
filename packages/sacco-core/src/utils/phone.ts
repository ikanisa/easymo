/**
 * Format a Rwandan phone number for display
 * @param phone - Phone number (with or without country code)
 * @returns Formatted phone number (e.g., "078 123 4567")
 */
export function formatPhoneNumber(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  
  // Remove country code if present
  const local = clean.startsWith("250") ? clean.slice(3) : clean;
  
  if (local.length !== 9) {
    return phone; // Return original if not valid length
  }
  
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * Normalize phone number to E.164 format
 * @param phone - Phone number in any format
 * @returns Phone number in E.164 format (e.g., "+250781234567")
 */
export function normalizePhoneNumber(phone: string): string | null {
  const clean = phone.replace(/\D/g, "");
  
  // Already has country code
  if (clean.startsWith("250") && clean.length === 12) {
    return `+${clean}`;
  }
  
  // Add country code
  if (clean.length === 9) {
    return `+250${clean}`;
  }
  
  return null; // Invalid format
}

/**
 * Validate Rwandan phone number
 * @param phone - Phone number to validate
 * @returns True if valid Rwandan phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return false;
  
  // Rwanda mobile prefixes: 078, 079, 072, 073
  const validPrefixes = ["25078", "25079", "25072", "25073"];
  return validPrefixes.some((prefix) => normalized.startsWith(`+${prefix}`));
}
