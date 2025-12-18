/**
 * Security Module Index
 * Centralized exports for all security components
 * @module _shared/security
 */

// Middleware
export {
  SecurityMiddleware,
  createSecurityMiddleware,
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig,
  type SecurityContext,
  type SecurityCheckResult,
} from "./middleware.ts";

// Signature Verification
  verifySignature,
  verifyWebhookRequest,
  extractSignatureMetadata,
  type SignatureVerificationResult,
  type SignatureConfig,
} from "./signature.ts";

// Input Validation
  validateInput,
  sanitizeString,
  sanitizePhoneNumber,
  sanitizeForSQL,
  sanitizeForHTML,
  maskPhoneNumber,
  maskEmail,
  isValidPhoneNumber,
  isValidEmail,
  isValidUUID,
  hasSQLInjectionPatterns,
  hasXSSPatterns,
  COMMON_SCHEMAS,
  type ValidationRule,
  type ValidationSchema,
  type ValidationResult,
} from "./input-validator.ts";

// Audit Logging
  AuditLogger,
  createAuditLogger,
  type AuditAction,
  type AuditSeverity,
  type AuditEntry,
} from "./audit-logger.ts";

// Configuration
export { SECURITY_CONFIG } from "./config.ts";
