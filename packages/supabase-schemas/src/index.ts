/**
 * @easymo/supabase-schemas - Database schemas for the EasyMO platform
 * 
 * This package contains TypeScript types generated from or aligned with
 * the Supabase database schema.
 * 
 * Note: Re-exports schemas from @easymo/sacco-core for SACCO-related entities.
 */

// Re-export SACCO schemas from sacco-core
export {
  type CreateIkimina,
  CreateIkiminaSchema,
  type CreateMember,
  CreateMemberSchema,
  type CreatePayment,
  CreatePaymentSchema,
  type Ikimina,
  IkiminaSchema,
  type Member,
  MemberSchema,
  type Payment,
  PaymentSchema,
  type UpdateIkimina,
  UpdateIkiminaSchema,
  type UpdateMember,
  UpdateMemberSchema,
  type UpdatePayment,
  UpdatePaymentSchema,
} from '@easymo/sacco-core';

// Export database types
export * from './database.js';
export * from './enums.js';
