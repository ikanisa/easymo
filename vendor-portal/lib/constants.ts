/**
 * Centralized application constants
 * 
 * This file contains all magic strings, UUIDs, and configuration defaults
 * used throughout the application to ensure consistency and maintainability.
 */

export const CONSTANTS = {
  // Test/Stub values - used for development and testing
  TEST_USER_ID: "00000000-0000-4000-8000-000000000001" as const,
  TEST_EMAIL: "qa.staff@example.com" as const,
  TEST_SACCO_ID: "stub-sacco" as const,
  
  // Configuration defaults
  SIGNATURE_TOLERANCE_SECONDS: 300,
  DEFAULT_PAGE_SIZE: 30,
  MAX_PAGE_SIZE: 100,
  MAX_SEARCH_LENGTH: 100,
  
  // Password generation
  PASSWORD: {
    DEFAULT_LENGTH: 16,
    MIN_LENGTH: 12,
    CHARSET: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*",
  } as const,
  
  // Rate limiting presets
  RATE_LIMIT: {
    // Standard rate limit: 60 requests per minute
    STANDARD: { maxRequests: 60, windowMs: 60000 },
    // Strict rate limit for sensitive operations: 10 requests per minute
    STRICT: { maxRequests: 10, windowMs: 60000 },
    // Auth operations: 5 attempts per 5 minutes
    AUTH: { maxRequests: 5, windowMs: 300000 },
  } as const,
  
  // User roles
  ROLES: {
    SYSTEM_ADMIN: "SYSTEM_ADMIN",
    SACCO_MANAGER: "SACCO_MANAGER",
    SACCO_STAFF: "SACCO_STAFF",
    SACCO_VIEWER: "SACCO_VIEWER",
    DISTRICT_MANAGER: "DISTRICT_MANAGER",
    MFI_MANAGER: "MFI_MANAGER",
    MFI_STAFF: "MFI_STAFF",
  } as const,
  
  // Organization types
  ORG_TYPES: {
    SACCO: "SACCO",
    MFI: "MFI",
    DISTRICT: "DISTRICT",
  } as const,
  
  // MFA Methods
  MFA_METHODS: {
    EMAIL: "EMAIL",
    TOTP: "TOTP",
    SMS: "SMS",
    WEBAUTHN: "WEBAUTHN",
  } as const,
} as const;

// Type helpers for better TypeScript support
export type AppRole = typeof CONSTANTS.ROLES[keyof typeof CONSTANTS.ROLES];
export type OrgType = typeof CONSTANTS.ORG_TYPES[keyof typeof CONSTANTS.ORG_TYPES];
export type MFAMethod = typeof CONSTANTS.MFA_METHODS[keyof typeof CONSTANTS.MFA_METHODS];
