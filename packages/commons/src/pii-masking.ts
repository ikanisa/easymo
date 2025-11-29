/**
 * PII (Personally Identifiable Information) Masking Utilities
 * 
 * Ensures sensitive data is not exposed in logs, metrics, or error messages.
 * Required by GROUND_RULES.md for all logging operations.
 */

/**
 * Mask phone number, showing only country code and last 2 digits
 * Examples:
 *   +254712345678 → +254*****78
 *   254712345678  → 254*****78
 *   0712345678    → 0712***78
 */
export function maskPhone(phone: string): string {
  if (!phone) return "";
  
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, "");
  
  // If starts with +, keep + and country code (1-3 digits)
  if (cleaned.startsWith("+")) {
    const countryCode = cleaned.match(/^\+\d{1,3}/)?.[0] || "+";
    const rest = cleaned.slice(countryCode.length);
    if (rest.length <= 2) return countryCode + "*".repeat(rest.length);
    return countryCode + "*".repeat(rest.length - 2) + rest.slice(-2);
  }
  
  // If local format (0712345678), keep first 4 and last 2
  if (cleaned.startsWith("0") && cleaned.length >= 7) {
    return cleaned.slice(0, 4) + "*".repeat(cleaned.length - 6) + cleaned.slice(-2);
  }
  
  // Default: keep first 3 and last 2 digits
  if (cleaned.length <= 5) return "*".repeat(cleaned.length);
  return cleaned.slice(0, 3) + "*".repeat(cleaned.length - 5) + cleaned.slice(-2);
}

/**
 * Mask email address, showing only first 2 chars and domain
 * Examples:
 *   john.doe@example.com → jo****@example.com
 *   a@test.co            → a*@test.co
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  
  const [localPart, domain] = email.split("@");
  
  if (localPart.length <= 1) {
    return localPart + "*@" + domain;
  }
  
  if (localPart.length === 2) {
    return localPart[0] + "*@" + domain;
  }
  
  return localPart.slice(0, 2) + "*".repeat(Math.min(4, localPart.length - 2)) + "@" + domain;
}

/**
 * Mask national ID / passport number
 * Shows only first 2 and last 2 characters
 * Examples:
 *   1234567890123 → 12*********23
 *   A12345678     → A1*****78
 */
export function maskIdNumber(id: string): string {
  if (!id) return "";
  
  const cleaned = id.replace(/[\s-]/g, "");
  
  if (cleaned.length <= 4) {
    return "*".repeat(cleaned.length);
  }
  
  return cleaned.slice(0, 2) + "*".repeat(cleaned.length - 4) + cleaned.slice(-2);
}

/**
 * Mask credit card number (PCI compliance)
 * Shows only last 4 digits
 * Examples:
 *   4532123456781234 → ************1234
 *   4532-1234-5678-1234 → ************1234
 */
export function maskCardNumber(card: string): string {
  if (!card) return "";
  
  const cleaned = card.replace(/[\s-]/g, "");
  
  if (cleaned.length <= 4) {
    return "*".repeat(cleaned.length);
  }
  
  return "*".repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Mask address, keeping only city and country
 * Examples:
 *   { street: "123 Main St", city: "Kigali", country: "Rwanda" } 
 *     → { street: "***", city: "Kigali", country: "Rwanda" }
 */
export function maskAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
} {
  return {
    street: address.street ? "***" : undefined,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode ? "***" : undefined,
    country: address.country,
  };
}

/**
 * Mask an object containing PII fields
 * Automatically detects and masks common PII fields
 */
export function maskPII<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  
  const masked = { ...obj } as any;
  
  for (const [key, value] of Object.entries(masked)) {
    const lowerKey = key.toLowerCase();
    
    // Phone number fields
    if (
      lowerKey.includes("phone") ||
      lowerKey.includes("mobile") ||
      lowerKey.includes("msisdn") ||
      lowerKey.includes("telephone")
    ) {
      masked[key] = typeof value === "string" ? maskPhone(value) : value;
      continue;
    }
    
    // Email fields
    if (lowerKey.includes("email")) {
      masked[key] = typeof value === "string" ? maskEmail(value) : value;
      continue;
    }
    
    // ID/passport fields
    if (
      lowerKey.includes("nationalid") ||
      lowerKey.includes("passport") ||
      lowerKey.includes("idnumber") ||
      lowerKey === "nid"
    ) {
      masked[key] = typeof value === "string" ? maskIdNumber(value) : value;
      continue;
    }
    
    // Card number fields
    if (lowerKey.includes("card") && lowerKey.includes("number")) {
      masked[key] = typeof value === "string" ? maskCardNumber(value) : value;
      continue;
    }
    
    // Nested objects
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      masked[key] = maskPII(value);
    }
  }
  
  return masked as T;
}

/**
 * Safe logger wrapper that automatically masks PII
 * Use this instead of console.log for production
 */
export function logSafely(level: "info" | "warn" | "error", message: string, data?: any): void {
  const maskedData = data ? maskPII(data) : undefined;
  
  const logEntry = {
    level,
    msg: message,
    timestamp: new Date().toISOString(),
    ...(maskedData && { data: maskedData }),
  };
  
  console.log(JSON.stringify(logEntry));
}
