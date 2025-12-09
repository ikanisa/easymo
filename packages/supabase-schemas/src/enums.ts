/**
 * Database enum types
 */

export type UserRole = 'user' | 'admin' | 'staff';

export type EntityStatus = 'active' | 'inactive' | 'suspended';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export type PaymentMethod = 'momo' | 'cash' | 'bank_transfer' | 'ussd';

export type IkiminaType = 'ASCA' | 'VSLA' | 'SILC' | 'ROSCA';

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type TerminalStatus = 'active' | 'inactive' | 'offline' | 'maintenance';

export type SmsProcessingStatus = 'pending' | 'processed' | 'failed' | 'ignored';

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';
