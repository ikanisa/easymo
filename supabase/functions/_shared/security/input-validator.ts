/**
 * Input Validation and Sanitization Module
 * Provides comprehensive input validation for all user inputs
 */

import { logStructuredEvent } from "../observability.ts";

// ============================================================================
// TYPES
// ============================================================================

export type ValidationRule = {
  type: "string" | "number" | "boolean" | "array" | "object" | "phone" | "email" | "uuid";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
  sanitize?: boolean;
};

export type ValidationSchema = Record<string, ValidationRule>;

export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
  sanitized: Record<string, unknown>;
};

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  
  return input
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters except newline and tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Trim whitespace
    .trim();
}

/**
 * Sanitize for SQL - escape special characters
 * Note: Always use parameterized queries, this is defense in depth
 */
export function sanitizeForSQL(input: string): string {
  if (typeof input !== "string") return "";
  
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "");
}

/**
 * Sanitize for HTML - prevent XSS
 */
export function sanitizeForHTML(input: string): string {
  if (typeof input !== "string") return "";
  
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  
  return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Sanitize phone number - keep only digits and leading +
 */
export function sanitizePhoneNumber(input: string): string {
  if (typeof input !== "string") return "";
  
  const cleaned = input.replace(/[^\d+]/g, "");
  // Ensure only one + at the start
  if (cleaned.startsWith("+")) {
    return "+" + cleaned.slice(1).replace(/\+/g, "");
  }
  return cleaned;
}

/**
 * Mask phone number for logging
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return "***";
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

/**
 * Mask email for logging
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length > 2 
    ? local[0] + "***" + local[local.length - 1]
    : "***";
  return `${maskedLocal}@${domain}`;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

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
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
}

/**
 * Check for potential SQL injection patterns
 */
export function hasSQLInjectionPatterns(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--)/, // SQL comment
    /(;).*(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i, // Statement termination followed by SQL
    /(')\s*(OR|AND)\s*('|1|true)/i, // Classic injection
    /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i, // 1=1 pattern
  ];
  
  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Check for potential XSS patterns
 */
export function hasXSSPatterns(input: string): boolean {
  const xssPatterns = [
    /<script\b[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /expression\s*\(/i,
  ];
  
  return xssPatterns.some((pattern) => pattern.test(input));
}

// ============================================================================
// SCHEMA VALIDATOR
// ============================================================================

/**
 * Validate input against schema
 */
export function validateInput(
  data: Record<string, unknown>,
  schema: ValidationSchema,
  options: { sanitize?: boolean; logViolations?: boolean } = {}
): ValidationResult {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, unknown> = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];

    // Check required
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors[field] = `${field} is required`;
      continue;
    }

    // Skip validation for optional empty values
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    switch (rule.type) {
      case "string": {
        if (typeof value !== "string") {
          errors[field] = `${field} must be a string`;
          break;
        }
        
        let sanitizedValue = options.sanitize !== false ? sanitizeString(value) : value;
        
        // Check for injection patterns
        if (hasSQLInjectionPatterns(sanitizedValue)) {
          errors[field] = `${field} contains invalid characters`;
          if (options.logViolations) {
            logStructuredEvent("INPUT_VALIDATION_SQL_INJECTION", {
              field,
              masked: sanitizedValue.slice(0, 20) + "...",
            }, "warn");
          }
          break;
        }
        
        if (hasXSSPatterns(sanitizedValue)) {
          errors[field] = `${field} contains invalid characters`;
          if (options.logViolations) {
            logStructuredEvent("INPUT_VALIDATION_XSS", {
              field,
              masked: sanitizedValue.slice(0, 20) + "...",
            }, "warn");
          }
          break;
        }

        // Length validation
        if (rule.minLength && sanitizedValue.length < rule.minLength) {
          errors[field] = `${field} must be at least ${rule.minLength} characters`;
          break;
        }
        if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
          errors[field] = `${field} must be at most ${rule.maxLength} characters`;
          break;
        }

        // Pattern validation
        if (rule.pattern && !rule.pattern.test(sanitizedValue)) {
          errors[field] = `${field} format is invalid`;
          break;
        }

        sanitized[field] = sanitizedValue;
        break;
      }

      case "number": {
        const num = typeof value === "number" ? value : parseFloat(String(value));
        if (isNaN(num)) {
          errors[field] = `${field} must be a number`;
          break;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors[field] = `${field} must be at least ${rule.min}`;
          break;
        }
        if (rule.max !== undefined && num > rule.max) {
          errors[field] = `${field} must be at most ${rule.max}`;
          break;
        }
        sanitized[field] = num;
        break;
      }

      case "boolean": {
        if (typeof value !== "boolean") {
          errors[field] = `${field} must be a boolean`;
          break;
        }
        sanitized[field] = value;
        break;
      }

      case "phone": {
        const phoneStr = String(value);
        const sanitizedPhone = sanitizePhoneNumber(phoneStr);
        // Accept any phone number format - no validation
        sanitized[field] = sanitizedPhone;
        break;
      }

      case "email": {
        const emailStr = sanitizeString(String(value));
        if (!isValidEmail(emailStr)) {
          errors[field] = `${field} must be a valid email address`;
          break;
        }
        sanitized[field] = emailStr.toLowerCase();
        break;
      }

      case "uuid": {
        const uuidStr = String(value);
        if (!isValidUUID(uuidStr)) {
          errors[field] = `${field} must be a valid UUID`;
          break;
        }
        sanitized[field] = uuidStr.toLowerCase();
        break;
      }

      case "array": {
        if (!Array.isArray(value)) {
          errors[field] = `${field} must be an array`;
          break;
        }
        if (rule.minLength && value.length < rule.minLength) {
          errors[field] = `${field} must have at least ${rule.minLength} items`;
          break;
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors[field] = `${field} must have at most ${rule.maxLength} items`;
          break;
        }
        sanitized[field] = value;
        break;
      }

      case "object": {
        if (typeof value !== "object" || Array.isArray(value)) {
          errors[field] = `${field} must be an object`;
          break;
        }
        sanitized[field] = value;
        break;
      }
    }

    // Custom validation
    if (!errors[field] && rule.custom && !rule.custom(value)) {
      errors[field] = `${field} is invalid`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const COMMON_SCHEMAS = {
  phoneNumber: {
    phone: { type: "phone" as const, required: true },
  },
  
  profileUpdate: {
    full_name: { type: "string" as const, minLength: 1, maxLength: 100 },
    email: { type: "email" as const },
    language: { type: "string" as const, pattern: /^[a-z]{2}(-[A-Z]{2})?$/ },
  },
  
  walletTransfer: {
    recipient: { type: "phone" as const, required: true },
    amount: { type: "number" as const, required: true, min: 1, max: 1000000 },
  },
  
  tripBooking: {
    pickup_lat: { type: "number" as const, required: true, min: -90, max: 90 },
    pickup_lng: { type: "number" as const, required: true, min: -180, max: 180 },
    dropoff_lat: { type: "number" as const, min: -90, max: 90 },
    dropoff_lng: { type: "number" as const, min: -180, max: 180 },
    vehicle_type: { type: "string" as const, pattern: /^(moto|cab|lifan|truck|others)$/ },
  },
  
  claimSubmission: {
    claim_type: { type: "string" as const, required: true, pattern: /^claim_(accident|theft|damage|third_party)$/ },
    description: { type: "string" as const, required: true, minLength: 10, maxLength: 5000 },
  },
};
