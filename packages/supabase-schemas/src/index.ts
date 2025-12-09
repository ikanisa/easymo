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
  MemberSchema,
  type Member,
  CreateMemberSchema,
  type CreateMember,
  UpdateMemberSchema,
  type UpdateMember,
  
  IkiminaSchema,
  type Ikimina,
  CreateIkiminaSchema,
  type CreateIkimina,
  UpdateIkiminaSchema,
  type UpdateIkimina,
  
  PaymentSchema,
  type Payment,
  CreatePaymentSchema,
  type CreatePayment,
  UpdatePaymentSchema,
  type UpdatePayment,
} from '@easymo/sacco-core';

// Export database types
export * from './database.js';
export * from './enums.js';
