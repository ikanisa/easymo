// NOTE: This module uses Node.js crypto and should only be used server-side
// For client-side usage, use Web Crypto API or a cross-platform library
import { createHash } from 'crypto';

/**
 * Mask a phone number for display purposes
 * Example: +250788123456 -> +250****3456
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +250 (Rwanda), mask the middle digits
  if (cleaned.startsWith('+250')) {
    const countryCode = '+250';
    const remaining = cleaned.slice(4);
    if (remaining.length >= 4) {
      const last4 = remaining.slice(-4);
      return `${countryCode}****${last4}`;
    }
  }
  
  // Generic masking: show first 3 and last 4
  if (cleaned.length > 7) {
    const start = cleaned.slice(0, 3);
    const end = cleaned.slice(-4);
    return `${start}****${end}`;
  }
  
  return cleaned;
}

/**
 * Hash a phone number for database lookups
 * Uses SHA-256 for consistent hashing
 */
export function hashPhone(phone: string): string {
  if (!phone) return '';
  
  // Normalize: remove all non-digit characters except +
  const normalized = phone.replace(/[^\d+]/g, '');
  
  return createHash('sha256')
    .update(normalized)
    .digest('hex');
}

/**
 * Mask a national ID for display purposes
 * Example: 1234567890123456 -> 1234****3456
 */
export function maskNationalId(nationalId: string): string {
  if (!nationalId) return '';
  
  const cleaned = nationalId.replace(/\D/g, '');
  
  if (cleaned.length > 8) {
    const start = cleaned.slice(0, 4);
    const end = cleaned.slice(-4);
    return `${start}****${end}`;
  }
  
  return cleaned;
}

/**
 * Hash a national ID for database lookups
 * Uses SHA-256 for consistent hashing
 */
export function hashNationalId(nationalId: string): string {
  if (!nationalId) return '';
  
  // Normalize: remove all non-digit characters
  const normalized = nationalId.replace(/\D/g, '');
  
  return createHash('sha256')
    .update(normalized)
    .digest('hex');
}

/**
 * Normalize phone number to E.164 format
 * Assumes Rwanda (+250) if no country code provided
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already has country code, return as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 0, remove it (Rwanda domestic format)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  // Add Rwanda country code if not present
  if (!cleaned.startsWith('250')) {
    cleaned = `250${cleaned}`;
  }
  
  return `+${cleaned}`;
}
