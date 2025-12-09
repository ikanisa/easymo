// ═══════════════════════════════════════════════════════════════════════════
// Payment Types
// ═══════════════════════════════════════════════════════════════════════════

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  status: PaymentStatus;
  confidence: number | null;
  created_at: string;
  processed_at: string | null;
  metadata: Record<string, unknown>;
  member: PaymentMember | null;
  ikimina: PaymentIkimina | null;
}

export type PaymentStatus = "matched" | "pending" | "failed" | "unmatched";

export interface PaymentMember {
  id: string;
  full_name: string;
  member_code: string | null;
  msisdn_masked: string | null;
}

export interface PaymentIkimina {
  id: string;
  name: string;
  code: string;
}

export interface UnmatchedSMS {
  id: string;
  sender: string;
  message: string;
  received_at: string;
  parsed_data: {
    amount?: number;
    sender_name?: string;
    sender_phone?: string;
    transaction_id?: string;
    provider?: string;
  } | null;
  confidence: number | null;
  status: string;
  created_at: string;
}

export interface Member {
  id: string;
  member_code: string | null;
  full_name: string;
  msisdn_masked: string | null;
  status: MemberStatus;
  joined_at: string;
  created_at: string;
  ikimina: {
    id: string;
    name: string;
    code: string;
  } | null;
  accounts: Account[];
  total_balance?: number;
}

export type MemberStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface Account {
  id: string;
  account_type: AccountType;
  balance: number;
  currency: string;
  status: string;
}

export type AccountType = "savings" | "loan" | "shares";

export interface PaymentStats {
  members: {
    total: number;
  };
  groups: {
    total: number;
  };
  payments: {
    total: number;
    total_amount: number;
    matched: number;
    unmatched: number;
    today_count: number;
    today_amount: number;
    match_rate: number;
  };
  savings: {
    total: number;
    currency: string;
  };
}
