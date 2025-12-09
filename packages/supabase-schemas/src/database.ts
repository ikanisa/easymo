/**
 * Database table type definitions
 * These are placeholder types that will be populated from Supabase generated types
 */

import { z } from 'zod';

// Common fields for all tables
const BaseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional(),
});

/**
 * User table schema
 */
export const UserSchema = BaseSchema.extend({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  role: z.enum(['user', 'admin', 'staff']).default('user'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  metadata: z.record(z.unknown()).optional(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * SACCO table schema
 */
export const SaccoSchema = BaseSchema.extend({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  logo_url: z.string().url().optional(),
  settings_json: z.record(z.unknown()).default({}),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

export type Sacco = z.infer<typeof SaccoSchema>;

/**
 * MomoTerminal device schema
 */
export const MomoTerminalSchema = BaseSchema.extend({
  device_id: z.string(),
  sacco_id: z.string().uuid().optional(),
  vendor_id: z.string().uuid().optional(),
  name: z.string(),
  status: z.enum(['active', 'inactive', 'offline', 'maintenance']).default('inactive'),
  last_seen_at: z.string().datetime().optional(),
  firmware_version: z.string().optional(),
  settings_json: z.record(z.unknown()).default({}),
});

export type MomoTerminal = z.infer<typeof MomoTerminalSchema>;

/**
 * SMS Webhook Log schema
 */
export const SmsWebhookLogSchema = BaseSchema.extend({
  terminal_id: z.string().uuid(),
  sender: z.string(),
  message: z.string(),
  parsed_amount: z.number().int().optional(),
  parsed_reference: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: z.enum(['pending', 'processed', 'failed', 'ignored']).default('pending'),
  processed_at: z.string().datetime().optional(),
  error_message: z.string().optional(),
});

export type SmsWebhookLog = z.infer<typeof SmsWebhookLogSchema>;

/**
 * Audit log schema
 */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  table_name: z.string(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  old_data: z.record(z.unknown()).optional(),
  new_data: z.record(z.unknown()).optional(),
  user_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
