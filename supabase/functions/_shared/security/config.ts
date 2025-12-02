/**
 * Security Configuration for All Microservices
 */

import { SecurityConfig } from "./middleware.ts";

export const SERVICE_SECURITY_CONFIGS: Record<string, Partial<SecurityConfig>> = {
  "wa-webhook-core": {
    maxBodySize: 1024 * 1024,
    rateLimit: { enabled: true, limit: 100, windowSeconds: 60 },
  },
  "wa-webhook-profile": {
    maxBodySize: 2 * 1024 * 1024,
    rateLimit: { enabled: true, limit: 100, windowSeconds: 60 },
  },
  "wa-webhook-mobility": {
    maxBodySize: 1024 * 1024,
    rateLimit: { enabled: true, limit: 100, windowSeconds: 60 },
  },
  "wa-webhook-insurance": {
    maxBodySize: 10 * 1024 * 1024,
    rateLimit: { enabled: true, limit: 50, windowSeconds: 60 },
  },
};

export function getServiceSecurityConfig(serviceName: string): Partial<SecurityConfig> {
  return SERVICE_SECURITY_CONFIGS[serviceName] || {};
}

export const AUDITED_OPERATIONS = [
  "profile_create", "profile_update", "wallet_transfer", "wallet_deposit",
  "trip_create", "insurance_claim_submit", "admin_action",
];

export function shouldAudit(operation: string): boolean {
  return AUDITED_OPERATIONS.includes(operation.toLowerCase());
}
