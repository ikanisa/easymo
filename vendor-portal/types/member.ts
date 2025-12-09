// ═══════════════════════════════════════════════════════════════════════════
// Member Types
// Description: TypeScript types matching database schema and function returns
// ═══════════════════════════════════════════════════════════════════════════

export type MemberStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DELETED";

export type Gender = "male" | "female" | "other";

// ─────────────────────────────────────────────────────────────────────────────
// Address Structure
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberAddress {
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Member Entity
// ─────────────────────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  sacco_id: string;
  ikimina_id: string | null;
  member_code: string;
  full_name: string;
  msisdn_masked: string | null;
  national_id: string | null;
  email: string | null;
  gender: Gender | null;
  date_of_birth: string | null; // ISO date string
  address: MemberAddress;
  status: MemberStatus;
  joined_at: string; // ISO datetime string
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Member with Relations
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberWithRelations extends Member {
  ikimina?: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
  accounts?: MemberAccount[];
  total_balance?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Member Account
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberAccount {
  id: string;
  account_type: "savings" | "shares" | "loan" | "welfare";
  balance: number;
  currency: string;
  status: "ACTIVE" | "INACTIVE" | "FROZEN";
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Member Summary (from get_member_summary function)
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberSummary {
  member_id: string;
  member_code: string;
  full_name: string;
  msisdn_masked: string | null;
  email: string | null;
  status: string;
  joined_at: string;
  ikimina_id: string | null;
  ikimina_name: string | null;
  total_balance: number;
  total_payments: number;
  total_paid: number;
  last_payment_date: string | null;
  payment_count_30d: number;
  average_payment: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment History (from get_member_payment_history function)
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberPaymentHistory {
  payment_id: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  status: string;
  created_at: string;
  account_type: string | null;
  running_balance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction (from get_member_transactions function)
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberTransaction {
  transaction_id: string;
  account_id: string;
  account_type: string;
  amount: number;
  direction: "credit" | "debit";
  balance_after: number;
  description: string | null;
  reference: string | null;
  value_date: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Timeline (from get_member_activity function)
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberActivity {
  activity_id: string;
  activity_type: "payment" | "credit" | "debit";
  description: string;
  amount: number;
  reference_id: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Result (from search_members function)
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberSearchResult {
  id: string;
  member_code: string;
  full_name: string;
  msisdn_masked: string | null;
  ikimina_name: string | null;
  status: string;
  relevance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form Input Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateMemberInput {
  sacco_id: string;
  ikimina_id: string;
  full_name: string;
  phone: string;
  national_id?: string;
  email?: string;
  gender?: Gender;
  date_of_birth?: string; // ISO date string
  address?: MemberAddress;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemberInput {
  full_name?: string;
  phone?: string;
  national_id?: string;
  email?: string;
  gender?: Gender;
  date_of_birth?: string; // ISO date string
  address?: MemberAddress;
  ikimina_id?: string;
  status?: MemberStatus;
  metadata?: Record<string, unknown>;
}

export interface BulkImportMember {
  full_name: string;
  phone: string;
  ikimina_id?: string;
  national_id?: string;
  email?: string;
  gender?: Gender;
  date_of_birth?: string;
  address?: MemberAddress;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Import Result (from bulk_import_members function)
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkImportResult {
  total_count: number;
  success_count: number;
  error_count: number;
  errors: Array<{
    row: number;
    name: string;
    phone: string;
    error: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberListResponse {
  data: MemberWithRelations[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface MemberDetailResponse {
  member: MemberSummary;
  accounts: MemberAccount[];
  recent_payments: MemberPaymentHistory[];
  recent_activity: MemberActivity[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TransferMemberInput {
  member_id: string;
  new_ikimina_id: string;
  transfer_balance?: boolean;
}
